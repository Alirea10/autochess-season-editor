import { Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import {
  IconLayoutDashboard, IconSwords, IconUsers, IconShield,
  IconBolt,
  IconStar, IconDatabase, IconUserCog, IconBinaryTree,
} from '@tabler/icons-react'
import { isMiscModule } from '../store/miscNavigation'
import type { ActiveModule } from '../store/dataStore'

interface NavItem {
  id: ActiveModule
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  { id: 'overview', icon: <IconLayoutDashboard size={20} />, label: '概览' },
  { id: 'bonds', icon: <IconUsers size={20} />, label: '盟约' },
  { id: 'chess', icon: <IconSwords size={20} />, label: '棋子' },
  { id: 'traps', icon: <IconShield size={20} />, label: '装备' },
  { id: 'effects', icon: <IconBolt size={20} />, label: '效果' },
  { id: 'garrison', icon: <IconStar size={20} />, label: '特质' },
  { id: 'buffs', icon: <IconBinaryTree size={20} />, label: 'Buff' },
  { id: 'misc', icon: <IconDatabase size={20} />, label: '其他' },
]

interface Props {
  active: ActiveModule
  onChange: (m: ActiveModule) => void
  isAdmin?: boolean
}

export function Sidebar({ active, onChange, isAdmin }: Props) {
  const selected = isMiscModule(active) ? 'misc' : active
  const items = isAdmin
    ? [...navItems, { id: 'admin' as ActiveModule, icon: <IconUserCog size={20} />, label: '管理' }]
    : navItems

  return (
    <Stack
      gap={4}
      py="md"
      px={8}
      style={{
        width: 60,
        borderRight: '1px solid var(--mantine-color-dark-4)',
        height: '100%',
        flexShrink: 0,
        overflowY: 'auto',
        background: 'var(--mantine-color-dark-8)',
      }}
    >
      {items.map(item => (
        <Tooltip key={item.id} label={item.label} position="right" withArrow>
          <UnstyledButton
            aria-current={selected === item.id ? 'page' : undefined}
            onClick={() => onChange(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              borderRadius: 8,
              cursor: 'pointer',
              color: selected === item.id ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-dark-2)',
              background: selected === item.id ? 'var(--mantine-color-teal-9)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            {item.icon}
            <Text size="9px" mt={3} lh={1}>{item.label}</Text>
          </UnstyledButton>
        </Tooltip>
      ))}
    </Stack>
  )
}
