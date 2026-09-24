import { Button, Group, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { DataStore } from '../../store/dataStore'
import { useCollabField } from '../../hooks/useCollabField'
import { buildChessPairs } from './bondMembership'
import { useBondMembership } from './useBondMembership'

export function ChessBondPicker({ store, chessId }: { store: DataStore; chessId: string }) {
  const [bondId, setBondId] = useState<string | null>(null)
  const [scope, setScope] = useState<string | null>('both')
  const data = store.activeSeason!.data
  const pair = buildChessPairs(data).get(chessId)
  const field = useCollabField(pair?.id ?? chessId, 'bondMembership')
  const membership = useBondMembership(store)
  const conflict = scope === 'both' && pair?.conflict
  const ids = scope === 'both' ? pair?.ids ?? [chessId] : [chessId]
  const already = !!bondId && ids.every(id => data.bondInfoDict[bondId]?.chessIdList.includes(id))
  const disabled = store.activeSeason!.readOnly || field.readOnly
  return <Stack gap="xs" onFocusCapture={field.onFocus} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) field.onBlur() }}>
    <Group gap="xs" align="end">
      <Select label="添加盟约" placeholder="搜索盟约名称或 ID" searchable clearable
        ref={field.followRef as React.RefObject<HTMLInputElement>} disabled={disabled}
        style={{ flex: '1 1 200px', minWidth: 0 }} value={bondId} onChange={setBondId}
        data={Object.entries(data.bondInfoDict).map(([id, bond]) => ({ value: id, label: `${bond.name} (${id})` }))} />
      <Select label="版本范围" w={150} value={scope} disabled={disabled} onChange={setScope}
        data={[{ value: 'both', label: '普通＋精锐' }, { value: 'current', label: '仅当前版本' }]} />
      <Button disabled={disabled || !bondId || !!conflict || already || membership.locked(bondId ?? '', ids)} onClick={() => {
        if (bondId) membership.commit(bondId, [{ chessId, scope: scope === 'both' ? 'both' : data.charChessDataDict[chessId].isGolden ? 'golden' : 'normal', present: true }])
      }}>添加盟约</Button>
    </Group>
    {conflict ? <Text size="xs" c="orange">普通／精锐关联冲突，请选择仅当前版本。</Text>
      : pair && pair.ids.length < 2 ? <Text size="xs" c="dimmed">另一个版本缺失，仅添加现有版本。</Text> : null}
    {already && <Text size="xs" c="dimmed">所选版本已加入此盟约。</Text>}
  </Stack>
}
