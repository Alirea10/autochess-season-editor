import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Box, Button, CopyButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconPlus, IconX } from '@tabler/icons-react'
import { joinId, splitId } from './idNaming'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  preview?: string
  error?: string | null
  labels?: string[]
  selectLast?: boolean
  onSubmit?: () => void
}

export function SegmentedIdInput({ label, value, onChange, preview = joinId(splitId(value)), error, labels, selectLast, onSubmit }: Props) {
  const [full, setFull] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const parts = splitId(value)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const inputs = root.current?.querySelectorAll<HTMLInputElement>('input')
      const input = inputs?.[selectLast ? inputs.length - 1 : 0]
      input?.focus(); input?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [selectLast])
  function updatePart(index: number, text: string) {
    const next = [...parts]
    next.splice(index, 1, ...splitId(text))
    onChange(next.join('_'))
  }
  return (
    <Stack gap="xs" ref={root} onKeyDown={event => {
      if (event.target instanceof HTMLInputElement && event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault()
        if (!error) onSubmit?.()
      }
    }}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => setFull(!full)}>{full ? '分段编辑' : '完整 ID'}</Button>
      </Group>
      {full ? <TextInput aria-label={label} value={value} onChange={event => onChange(event.currentTarget.value)} /> : (
        <Group gap={5} align="flex-start">
          {parts.map((part, index) => (
            <Group key={index} gap={5} align="flex-start" wrap="nowrap" style={{ maxWidth: '100%' }}>
              {index > 0 && <Text mt={26} c="dimmed">_</Text>}
              <Box w={labels?.[index] === '星级' || labels?.[index] === '版本' ? 76 : 116}>
                <TextInput label={labels?.[index] ?? `段 ${index + 1}`} aria-label={`${label} ${labels?.[index] ?? `段 ${index + 1}`}`}
                  value={part} error={!part.trim() ? '不能为空' : undefined}
                  onChange={event => updatePart(index, event.currentTarget.value)}
                  onPaste={event => {
                    const text = event.clipboardData.getData('text').trim()
                    if (text.includes('_')) { event.preventDefault(); onChange(text) }
                  }} />
                <Group gap={2} mt={3}>
                  <Tooltip label="在后面插入一段"><ActionIcon variant="subtle" size="xs" aria-label={`在第 ${index + 1} 段后插入`} onClick={() => {
                    const next = [...parts]; next.splice(index + 1, 0, ''); onChange(next.join('_'))
                  }}><IconPlus size={12} /></ActionIcon></Tooltip>
                  <Tooltip label="删除此段"><ActionIcon variant="subtle" color="gray" size="xs" disabled={parts.length === 1} aria-label={`删除第 ${index + 1} 段`}
                    onClick={() => onChange(parts.filter((_, i) => i !== index).join('_'))}><IconX size={12} /></ActionIcon></Tooltip>
                </Group>
              </Box>
            </Group>
          ))}
        </Group>
      )}
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>最终 ID</Text>
        <Text size="sm" ff="monospace" style={{ overflowWrap: 'anywhere', flex: 1 }}>{preview || '尚未填写'}</Text>
        <CopyButton value={preview}>{({ copied, copy }) => <ActionIcon aria-label="复制最终 ID" size="sm" variant="subtle" disabled={!preview} onClick={copy}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </ActionIcon>}</CopyButton>
      </Group>
      <Text size="xs" c={error ? 'red' : 'teal'} role="status">{error ?? 'ID 可用'}</Text>
    </Stack>
  )
}
