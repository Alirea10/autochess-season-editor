import type { PropsWithChildren, ReactNode } from 'react'
import { ActionIcon, Text, UnstyledButton } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { getEnemyName, getEnemyWikiUrl } from './enemyNames'
import styles from './EnemyCard.module.css'

interface Props {
  enemyId: string
  actions?: ReactNode
  details?: ReactNode
  selected?: boolean
  onSelect?: () => void
}

export function EnemyCard({ enemyId, actions, details, selected, onSelect, children }: PropsWithChildren<Props>) {
  const name = getEnemyName(enemyId)
  const href = getEnemyWikiUrl(enemyId)
  const title = name ?? (enemyId ? '未收录名称' : '待填写敌人 ID')
  const identity = <>
    <Text component="span" className={styles.name} fw={600} size="sm" c={name ? undefined : 'dimmed'}>{title}</Text>
    {!children && <Text component="span" className={styles.id} size="xs" c="dimmed" ff="monospace">{enemyId}</Text>}
  </>
  return <div className={styles.card} data-enemy-card={enemyId} data-selected={selected || undefined}>
    <div className={styles.header}>
      {onSelect
        ? <UnstyledButton className={styles.identity} aria-label={`选择 ${title} ${enemyId}`} onClick={onSelect}>{identity}</UnstyledButton>
        : <div className={styles.identity}>{identity}</div>}
      <div className={styles.actions}>
        {href && <ActionIcon component="a" href={href} target="_blank" rel="noopener noreferrer"
          size="sm" variant="subtle" color="teal" aria-label={`在 PRTS 查看 ${name}`} title="在新标签页打开 PRTS"
          onClick={event => event.stopPropagation()}><IconExternalLink size={14} /></ActionIcon>}
        {actions}
      </div>
    </div>
    {children}
    {details && <div className={styles.details}>{details}</div>}
  </div>
}
