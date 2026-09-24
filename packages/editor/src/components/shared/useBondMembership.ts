import { flushSync } from 'react-dom'
import { notifications } from '@mantine/notifications'
import type { DataStore } from '../../store/dataStore'
import { flushPendingEdits } from '../../store/pendingEdits'
import { useCollab } from '../../context/CollabContext'
import { buildChessPairs, changeBondMembership, type MembershipChange } from './bondMembership'

export function useBondMembership(store: DataStore) {
  const { users, currentUserId } = useCollab()
  function locked(bondId: string, chessIds: string[] = []) {
    return users.some(user => user.userId !== currentUserId && (
      (user.module === 'bonds' && user.focusId === bondId && ['chessIdList', '所属棋子'].includes(user.focusField ?? '')) ||
      (user.module === 'chess' && chessIds.includes(user.focusId ?? '') && user.focusField === 'bondMembership')
    ))
  }
  function commit(bondId: string, changes: MembershipChange[]) {
    flushPendingEdits()
    const season = store.activeSeasonId && store.getSeason(store.activeSeasonId)
    try {
      if (!season || season.readOnly) throw new Error('当前赛季不可编辑')
      const pairs = buildChessPairs(season.data)
      const ids = changes.flatMap(change => {
        const pair = pairs.get(change.chessId)
        return [change.chessId, pair?.id ?? '', ...(pair?.ids ?? [])]
      })
      if (locked(bondId, ids)) throw new Error('其他协作者正在编辑该盟约关联，请稍后重试')
      const next = changeBondMembership(season.data, bondId, changes)
      flushSync(() => store.updateSeason(season.id, () => next))
      return true
    } catch (error) {
      notifications.show({ title: '无法更新盟约成员', message: error instanceof Error ? error.message : String(error), color: 'red' })
      return false
    }
  }
  return { commit, locked }
}
