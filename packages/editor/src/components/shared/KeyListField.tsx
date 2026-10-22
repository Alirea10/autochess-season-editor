import { useEffect, useRef, useState } from 'react'
import { Stack, Text, Group, ActionIcon, Button } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { CTextInput } from '../collab/CollabInputs'

export function KeyListField({ label, keys, onChange, collabPrefix, preserveDraft }: { label: string; keys: string[]; onChange: (v: string[]) => void; collabPrefix?: string; preserveDraft?: boolean }) {
  const [draft, setDraft] = useState<string[]>(keys)
  const lastCommittedRef = useRef(JSON.stringify(keys))

  useEffect(() => {
    const incoming = JSON.stringify(keys)
    if (incoming !== lastCommittedRef.current) {
      setDraft(keys)
      lastCommittedRef.current = incoming
    }
  }, [keys])

  function commit(next: string[]) {
    setDraft(next)
    if (preserveDraft) {
      const sanitized = next.map(v => v.trim()).filter(Boolean)
      lastCommittedRef.current = JSON.stringify(sanitized)
      onChange(sanitized)
      return
    }
    lastCommittedRef.current = JSON.stringify(next)
    onChange(next)
  }

  return (
    <Stack gap="xs">
      {label && <Text size="sm" fw={500}>{label}</Text>}
      {draft.map((k, i) => (
        <Group key={i} gap="xs">
          <CTextInput size="xs" collabField={collabPrefix ? `${collabPrefix}[${i}]` : undefined} value={k} style={{ flex: 1 }}
            onChange={e => { const n = [...draft]; n[i] = e.target.value; commit(n) }} />
          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => commit(draft.filter((_, j) => j !== i))}>
            <IconTrash size={10} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={10} />} w="fit-content"
        onClick={() => preserveDraft ? setDraft([...draft, '']) : onChange([...draft, ''])}>添加</Button>
    </Stack>
  )
}
