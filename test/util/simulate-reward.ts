import { sumBy } from 'lodash'
import { SimulateDataArgs } from './deploy'

export const simulateReward = (info: SimulateDataArgs) => {
  const ONE_GWEI = 1_000_000_000

  const { pool, stakings } = info
  const rewards: {
    [address: string]: number
  } = {}
  for (const staking of stakings) {
    rewards[staking.wallet.address] = 0
  }
  for (let i = pool.start; i < pool.end; i++) {
    const elapsed = i - pool.start
    const rewardPerSecond =
      (pool.totalReward * ONE_GWEI) / (pool.end - pool.start)
    const filteredStakings = stakings.filter(
      staking => staking.start <= elapsed && elapsed <= staking.end
    )
    const currentTotalStaked = sumBy(
      filteredStakings,
      staking => staking.amount * ONE_GWEI
    )
    const currentRewardPerToken = rewardPerSecond / currentTotalStaked
    for (const staking of filteredStakings) {
      rewards[staking.wallet.address] += currentRewardPerToken * staking.amount
    }
  }

  return rewards
}
