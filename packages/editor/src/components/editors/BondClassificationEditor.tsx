import { useState } from 'react'
import { Alert, Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import { CMultiSelect, CNumberInput, CSelect, CTextInput, CollabEditingProvider } from '../collab/CollabInputs'
import {
  enableBondClassification, inspectBondClassification, withBondClassification,
  type AutoChessSeasonData, type BondBanRule, type BondClassification,
} from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'

export const BOND_RULE_OPTIONS = [
  { value: 'all', label: 'all：抽中即禁用全部成员' },
  { value: 'normal', label: 'normal：全部 normal 盟约联合命中' },
  { value: 'release', label: 'release：抽中解除禁用' },
  { value: 'ignore', label: 'ignore：不抽选、不参与判定' },
  { value: 'immune', label: 'immune：成员永久免疫' },
]

/** Always patch the latest collaborative document, never a captured category snapshot. */
function patchClassification(store: DataStore, change: (config: BondClassification, data: AutoChessSeasonData) => void) {
  store.updateSeason(store.activeSeasonId!, data => {
    const { classification } = inspectBondClassification(data)
    if (!classification) return data
    change(classification, data)
    return withBondClassification(data, classification)
  })
}

export function BondClassificationManager({ store }: { store: DataStore }) {
  const [newName, setNewName] = useState('')
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [batchRule, setBatchRule] = useState<BondBanRule>('normal')
  const data = store.activeSeason?.data
  if (!data) return null
  const { classification, warning } = inspectBondClassification(data)
  const options = Object.values(data.bondInfoDict).map(bond => ({ value: bond.bondId, label: `${bond.name} (${bond.bondId})` }))
  if (!classification) return <Stack gap="xs">
    <Alert color={warning ? 'orange' : 'blue'} title="原版 normal 回退">
      {warning ? `${warning}。分类配置未生效，原始数据保留。` : '未启用分类规则，按核心／非核心池抽选，以角色全部盟约命中判定。旧 banCore 字段不生效。'}
      旧字段无法解析时采用服务器内置表。
    </Alert>
    <Button size="xs" onClick={() => store.updateSeason(store.activeSeasonId!, enableBondClassification)}>
      {warning ? '从旧字段重新启用分类规则' : '启用分类规则'}
    </Button>
    {data.banConfig?.mode === 'banCore' && <Text size="xs" c="dimmed">主动启用时会将旧 banCore 转换为 all；旧抽选免疫盟约转换为 ignore。</Text>}
  </Stack>
  return <CollabEditingProvider itemId="banConfig.classification"><Stack gap="sm">
    <Alert color="blue" title="盟约类别与禁用规则">
      类别各自独立抽选，规则在盟约上设置。normal 跨类别联合判定；解除和永久免疫优先。新机制报错时整局回退原版 normal。
    </Alert>
    <Group>
      <CTextInput label="新类别名称" value={newName} onChange={e => setNewName(e.target.value)} />
      <Button size="xs" mt="xl" disabled={!newName.trim()} onClick={() => {
        patchClassification(store, config => {
          let index = 1
          while (Object.hasOwn(config.classes, `custom${index}`)) index++
          config.classes[`custom${index}`] = { name: newName.trim(), bondIds: [], drawCount: 0 }
        })
        setNewName('')
      }}>新增类别</Button>
    </Group>
    {Object.entries(classification.classes).map(([id, category]) => <Card key={id} withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between"><Badge>{id}</Badge>
          {!['core', 'minor'].includes(id) && <Button size="xs" variant="subtle" color="red" onClick={() => patchClassification(store, config => { delete config.classes[id] })}>删除类别</Button>}
        </Group>
        <Group grow>
          <CTextInput label="类别名称" collabField={`classes.${id}.name`} value={category.name}
            onChange={e => patchClassification(store, config => { if (config.classes[id] && e.target.value.trim()) config.classes[id].name = e.target.value })} />
          <CNumberInput label="抽选数量" collabField={`classes.${id}.drawCount`} min={0} allowDecimal={false} value={category.drawCount}
            onChange={v => patchClassification(store, config => { if (config.classes[id]) config.classes[id].drawCount = Number(v) || 0 })} />
        </Group>
        <CMultiSelect label="成员盟约（可跨类别）" collabField={`classes.${id}.bondIds`} searchable data={options} value={category.bondIds}
          onChange={values => patchClassification(store, config => { if (config.classes[id]) config.classes[id].bondIds = values })} />
        <Button variant="light" size="xs" onClick={() => setBatchIds(category.bondIds)}>选择此类成员进行批量设置</Button>
      </Stack>
    </Card>)}
    <CMultiSelect label="批量设置：目标盟约" searchable data={options} value={batchIds} onChange={setBatchIds} />
    <Group align="end">
      <CSelect label="批量规则 tag" data={BOND_RULE_OPTIONS} value={batchRule} onChange={v => { if (v) setBatchRule(v as BondBanRule) }} />
      <Button size="xs" disabled={!batchIds.length} onClick={() => patchClassification(store, (config, latest) => {
        for (const id of batchIds) if (Object.hasOwn(latest.bondInfoDict, id)) config.bondRules[id] = batchRule
      })}>应用规则</Button>
    </Group>
    <Button size="xs" variant="subtle" onClick={() => store.updateSeason(store.activeSeasonId!, latest => {
      const banConfig = { ...latest.banConfig }
      delete banConfig.classification
      return { ...latest, banConfig }
    })}>关闭分类规则，使用原版 normal</Button>
  </Stack></CollabEditingProvider>
}

export function BondClassificationFields({ store, bondId }: { store: DataStore; bondId: string }) {
  const data = store.activeSeason?.data
  if (!data) return null
  const { classification } = inspectBondClassification(data)
  if (!classification) return <Text size="xs" c="dimmed">启用分类规则后可设置归类与规则 tag。</Text>
  return <CollabEditingProvider itemId="banConfig.classification"><Stack gap="xs">
    <CMultiSelect label="所属盟约类别" collabField={`membership.${bondId}`}
      data={Object.entries(classification.classes).map(([id, category]) => ({ value: id, label: category.name }))}
      value={Object.keys(classification.classes).filter(id => classification.classes[id].bondIds.includes(bondId))}
      onChange={values => patchClassification(store, config => {
        for (const [id, category] of Object.entries(config.classes)) {
          category.bondIds = category.bondIds.filter(member => member !== bondId)
          if (values.includes(id)) category.bondIds.push(bondId)
        }
      })} />
    <CSelect label="禁用规则 tag" collabField={`bondRules.${bondId}`} data={BOND_RULE_OPTIONS}
      value={classification.bondRules[bondId] ?? 'normal'}
      onChange={value => { if (value) patchClassification(store, config => { config.bondRules[bondId] = value as BondBanRule }) }} />
    <Text size="xs" c="dimmed">未抽中的 normal 盟约仍阻挡禁用；ignore 不阻挡，immune 始终保护成员。禁用只影响供应。</Text>
  </Stack></CollabEditingProvider>
}
