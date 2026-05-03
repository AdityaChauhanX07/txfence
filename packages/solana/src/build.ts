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
import type { Action, ChainId } from '@txfence/core'
import { isSolanaChain } from './constants.js'

// System Program address on all Solana clusters
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as const

export type SolanaSerializedTransaction = {
  chain: ChainId
  serializedMessage: Uint8Array
  signers: string[]
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

  if (action.kind === 'swap' || action.kind === 'contract_call') {
    throw new Error(
      'solana swap and contract call execution not yet implemented — use TransferAction for SOL transfers',
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
