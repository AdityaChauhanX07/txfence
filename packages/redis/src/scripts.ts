export const ACQUIRE_SCRIPT = `
local absoluteTotal = tonumber(redis.call('GET', KEYS[1])) or 0
local pendingTotal = tonumber(redis.call('GET', KEYS[2])) or 0
local amount = tonumber(ARGV[1])
local absoluteCapMax = tonumber(ARGV[2])
local rollingWindowMax = tonumber(ARGV[3])
local rollingWindowMs = tonumber(ARGV[4])
local currentTime = tonumber(ARGV[6])

if absoluteCapMax > 0 then
  if absoluteTotal + pendingTotal + amount > absoluteCapMax then
    return 'absolute_cap_exceeded'
  end
end

if rollingWindowMax > 0 then
  local windowStart = currentTime - rollingWindowMs
  redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', windowStart - 1)
  local members = redis.call('ZRANGEBYSCORE', KEYS[4], windowStart, '+inf')
  local windowSum = 0
  for _, member in ipairs(members) do
    local sep = string.find(member, ':', 1, true)
    if sep then
      windowSum = windowSum + (tonumber(string.sub(member, sep + 1)) or 0)
    end
  end
  if windowSum + pendingTotal + amount > rollingWindowMax then
    return 'rolling_window_exceeded'
  end
end

redis.call('INCRBY', KEYS[2], ARGV[1])
redis.call('SET', KEYS[3], ARGV[1], 'EX', 300)
return 'granted'
`

export const COMMIT_SCRIPT = `
local pendingTotal = tonumber(redis.call('GET', KEYS[2])) or 0
local amount = tonumber(ARGV[1])
local currentTime = ARGV[3]

if pendingTotal > amount then
  redis.call('DECRBY', KEYS[2], ARGV[1])
else
  redis.call('SET', KEYS[2], 0)
end

redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('ZADD', KEYS[4], currentTime, currentTime .. ':' .. ARGV[1])
redis.call('DEL', KEYS[3])
return 'ok'
`

export const RELEASE_SCRIPT = `
local pendingTotal = tonumber(redis.call('GET', KEYS[1])) or 0
local amount = tonumber(ARGV[1])

if pendingTotal > amount then
  redis.call('DECRBY', KEYS[1], ARGV[1])
else
  redis.call('SET', KEYS[1], 0)
end

redis.call('DEL', KEYS[2])
return 'ok'
`
