import {
  createSolanaRpc,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
  AccountRole,
  getU32Codec,
  getU64Codec,
} from '@solana/kit'
import type { Action, ChainId, SolanaAccountMeta } from '@txfence/core'
import { isSolanaChain } from './constants.js'

// System Program address on all Solana clusters
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as const

export type SolanaSerializedTransaction = {
  chain: ChainId
  serializedMessage: Uint8Array
  signers: string[]
}

function mapAccountRole(role: SolanaAccountMeta['role']): AccountRole {
  switch (role) {
    case 'writable_signer': return AccountRole.WRITABLE_SIGNER
    case 'readonly_signer': return AccountRole.READONLY_SIGNER
    case 'writable': return AccountRole.WRITABLE
    case 'readonly': return AccountRole.READONLY
  }
}

export async function buildSolanaTransaction(
  action: Action,
  chainId: ChainId,
  rpcUrl: string,
  fromAddress: string,
): Promise<SolanaSerializedTransaction> {
  if (!isSolanaChain(chainId)) {
    throw new Error(`chain not supported by Solana adapter: ${chainId}`)
  }

  if (action.kind === 'swap') {
    if (action.solanaTransaction !== undefined) {
      // pre-built transaction from builder (e.g. from Jupiter API)
      return { chain: chainId, serializedMessage: action.solanaTransaction, signers: [fromAddress] }
    }
    throw new Error(
      'SwapAction on Solana requires solanaTransaction — build the transaction using Jupiter or another aggregator and pass the serialized bytes',
    )
  }

  if (action.kind === 'contract_call') {
    if (action.solanaTransaction !== undefined) {
      // pre-built transaction — builder handles full instruction encoding
      return { chain: chainId, serializedMessage: action.solanaTransaction, signers: [fromAddress] }
    }

    if (action.solanaData !== undefined && action.solanaAccounts !== undefined) {
      // builder-provided instruction data and accounts
      const rpc = createSolanaRpc(rpcUrl)
      const { value: { blockhash, lastValidBlockHeight } } = await rpc.getLatestBlockhash().send()
      const fromAddr = address(fromAddress)
      const programAddr = address(action.contract)

      const instruction = {
        programAddress: programAddr,
        accounts: action.solanaAccounts.map(a => ({
          address: address(a.address),
          role: mapAccountRole(a.role),
        })),
        data: action.solanaData,
      }

      const message = pipe(
        createTransactionMessage({ version: 0 }),
        m => setTransactionMessageFeePayer(fromAddr, m),
        m => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, m),
        m => appendTransactionMessageInstruction(instruction, m),
      )

      const compiled = compileTransactionMessage(message)
      const encoder = getCompiledTransactionMessageEncoder()
      const serializedMessage = new Uint8Array(encoder.encode(compiled))
      return { chain: chainId, serializedMessage, signers: [fromAddress] }
    }

    throw new Error(
      'ContractCallAction on Solana requires either solanaTransaction or both solanaData and solanaAccounts',
    )
  }

  // TransferAction: build a System Program transfer instruction
  const rpc = createSolanaRpc(rpcUrl)

  // Fetch a recent blockhash to bound the transaction lifetime
  const { value: { blockhash, lastValidBlockHeight } } = await rpc.getLatestBlockhash().send()

  // Encode the System Program Transfer instruction data:
  // 4 bytes LE u32 (instruction discriminator = 2) + 8 bytes LE u64 (lamports)
  const u32Codec = getU32Codec()
  const u64Codec = getU64Codec()
  const data = new Uint8Array(12)
  u32Codec.write(2, data, 0)
  u64Codec.write(action.token.amount, data, 4)

  const fromAddr = address(fromAddress)
  const toAddr = address(action.to)
  const systemProgram = address(SYSTEM_PROGRAM_ADDRESS)

  const transferInstruction = {
    programAddress: systemProgram,
    accounts: [
      // sender must be writable and sign the transaction
      { address: fromAddr, role: AccountRole.WRITABLE_SIGNER },
      // recipient only needs to be writable
      { address: toAddr, role: AccountRole.WRITABLE },
    ],
    data,
  }

  // Build the transaction message with version 0 (supports address lookup tables)
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    m => setTransactionMessageFeePayer(fromAddr, m),
    m => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, m),
    m => appendTransactionMessageInstruction(transferInstruction, m),
  )

  // Compile the message to its binary wire representation
  const compiled = compileTransactionMessage(message)
  const encoder = getCompiledTransactionMessageEncoder()
  const serializedMessage = new Uint8Array(encoder.encode(compiled))

  return {
    chain: chainId,
    serializedMessage,
    signers: [fromAddress],
  }
}
