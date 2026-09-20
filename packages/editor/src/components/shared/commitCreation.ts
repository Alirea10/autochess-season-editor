import { flushSync } from 'react-dom'
import { notifications } from '@mantine/notifications'
import type { AutoChessSeasonData } from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'
import { flushPendingEdits } from '../../store/pendingEdits'

/** Modal drafts are local. Only commit once all validation passes against fresh data. */
export function commitCreation(store: DataStore, transform: (data: AutoChessSeasonData) => AutoChessSeasonData): boolean {
  flushPendingEdits()
  const season = store.activeSeasonId && store.getSeason(store.activeSeasonId)
  if (!season || season.readOnly) {
    notifications.show({ title: '无法创建', message: '赛季不可编辑，请重新选择赛季', color: 'red' })
    return false
  }
  try {
    const next = transform(season.data)
    flushSync(() => store.updateSeason(season.id, () => next))
    return true
  } catch (error) {
    notifications.show({ title: '无法创建', message: error instanceof Error ? error.message : String(error), color: 'red' })
    return false
  }
}
