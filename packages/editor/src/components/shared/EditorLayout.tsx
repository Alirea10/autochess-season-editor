import { forwardRef, type PropsWithChildren } from 'react'
import { Box, ScrollArea, Stack } from '@mantine/core'
import styles from './EditorLayout.module.css'

/** Pages with a persistent selector and an independently scrolling detail pane. */
const splitModules = new Set([
  'bonds', 'chess', 'traps', 'effects', 'garrison', 'modes', 'boss',
  'misc:specialEnemy', 'misc:band', 'misc:stage', 'misc:effectChoice',
])
export function hasSplitEditor(module: string) { return splitModules.has(module) }

export function EditorPage({ module, children }: PropsWithChildren<{ module: string }>) {
  return <Box className={styles.page} data-editor-page={module}>
    {hasSplitEditor(module)
      ? <Box className={styles.frame}>{children}</Box>
      : <ScrollArea className={styles.document} p="lg" offsetScrollbars>{children}</ScrollArea>}
  </Box>
}

export function EditorSplitLayout({ children }: PropsWithChildren) {
  return <div className={styles.split}>{children}</div>
}

export function EditorListPane({ children }: PropsWithChildren) {
  return <Stack component="section" aria-label="条目列表与筛选" gap="xs" className={styles.list}>{children}</Stack>
}

export const EditorListScrollArea = forwardRef<HTMLDivElement, PropsWithChildren>(function EditorListScrollArea({ children }, ref) {
  return <ScrollArea ref={ref} className={styles.listScroll} offsetScrollbars type="auto"
    styles={{ viewport: { overscrollBehaviorY: 'contain' } }}>{children}</ScrollArea>
})

export function EditorDetailPane({ children }: PropsWithChildren) {
  return <section tabIndex={0} aria-label="编辑详情" className={styles.detail}>{children}</section>
}
