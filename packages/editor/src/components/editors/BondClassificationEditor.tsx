import { useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { CMultiSelect, CNumberInput, CSelect, CTextInput, CollabEditingProvider } from '../collab/CollabInputs'
import {
  enableBondClassification,
  inspectBondClassification,
  resolveLegacyBanConfig,
  withBondClassification,
  type AutoChessSeasonData,
  type BondBanRule,
  type BondClassification,
} from '@autochess-editor/shared'
import type { DataStore } from '../../store/dataStore'
import { useCollab } from '../../context/CollabContext'
import { useCollabField } from '../../hooks/useCollabField'
import styles from './BondClassificationEditor.module.css'

export const BOND_RULE_OPTIONS = [
  { value: 'all', label: '抽中禁用全部成员' },
  { value: 'normal', label: '全部普通盟约命中才禁用' },
  { value: 'release', label: '抽中保护成员' },
  { value: 'ignore', label: '忽略抽选与判定' },
  { value: 'immune', label: '成员永久免疫' },
]

const RULE_COLORS: Record<BondBanRule, string> = {
  all: 'red',
  normal: 'gray',
  release: 'teal',
  ignore: 'gray',
  immune: 'blue',
}

/** Always patch the latest collaborative document, never a captured category snapshot. */
function patchClassification(
  store: DataStore,
  change: (config: BondClassification, data: AutoChessSeasonData) => void,
) {
  store.updateSeason(store.activeSeasonId!, (data) => {
    const { classification } = inspectBondClassification(data)
    if (!classification) return data
    change(classification, data)
    return withBondClassification(data, classification)
  })
}

export function BondClassificationManager({ store }: { store: DataStore }) {
  const data = store.activeSeason?.data
  if (!data) return null
  const { classification, warning } = inspectBondClassification(data)
  if (!classification)
    return (
      <Stack gap="xs">
        <Alert color={warning ? 'orange' : 'blue'} title="原版 normal 回退">
          {warning
            ? `${warning}。分类配置未生效，原始数据保留。`
            : '未启用分类规则，按核心／非核心池抽选，以角色全部盟约命中判定。旧 banCore 字段不生效。'}
          旧字段无法解析时采用服务器内置表。
        </Alert>
        <Button size="xs" onClick={() => store.updateSeason(store.activeSeasonId!, enableBondClassification)}>
          {warning ? '从旧字段重新启用分类规则' : '启用分类规则'}
        </Button>
        {data.banConfig?.mode === 'banCore' && (
          <Text size="xs" c="dimmed">
            主动启用时会将旧 banCore 转换为 all；旧抽选免疫盟约转换为 ignore。
          </Text>
        )}
      </Stack>
    )
  return <ClassificationWorkbench key={store.activeSeasonId} store={store} classification={classification} />
}

function ClassificationWorkbench({ store, classification }: { store: DataStore; classification: BondClassification }) {
  const [selectedCategory, setSelectedCategory] = useState('core')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const ids = ['core', 'minor', ...Object.keys(classification.classes).filter((id) => !['core', 'minor'].includes(id))]
  const activeId = Object.hasOwn(classification.classes, selectedCategory) ? selectedCategory : 'core'
  const addCategory = () => {
    if (!newName.trim()) return
    patchClassification(store, (config) => {
      let index = 1
      while (Object.hasOwn(config.classes, `custom${index}`)) index++
      config.classes[`custom${index}`] = { name: newName.trim(), bondIds: [], drawCount: 0 }
    })
    setNewName('')
    setAdding(false)
  }
  return (
    <CollabEditingProvider itemId="banConfig.classification">
      <Stack gap="sm" className={styles.workbench}>
        <div className={styles.heading}>
          <div>
            <Text fw={600}>盟约抽选与禁用规则</Text>
            <Text size="xs" c="dimmed">
              分类决定从哪里抽；每个盟约的规则决定抽中后的行为。
            </Text>
          </div>
          <Popover opened={adding} onChange={setAdding} position="bottom-end" width={280}>
            <Popover.Target>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setAdding((v) => !v)}
              >
                新增分类
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <TextInput
                  label="分类名称"
                  value={newName}
                  onChange={(e) => setNewName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCategory()
                    }
                  }}
                />
                <Button size="xs" disabled={!newName.trim()} onClick={addCategory}>
                  创建分类
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </div>
        <Tabs
          value={activeId}
          onChange={(value) => {
            if (value) setSelectedCategory(value)
          }}
        >
          <Tabs.List className={styles.tabs}>
            {ids.map((id) => {
              const category = classification.classes[id]
              return (
                <Tabs.Tab key={id} value={id}>
                  <span className={styles.tabLabel}>
                    {category.name}
                    <span className={styles.tabCount}>
                      {category.bondIds.length} 个 · 抽 {category.drawCount}
                    </span>
                  </span>
                </Tabs.Tab>
              )
            })}
          </Tabs.List>
          <Tabs.Panel value={activeId} pt="sm">
            <CategoryEditor key={activeId} store={store} classification={classification} categoryId={activeId} />
          </Tabs.Panel>
        </Tabs>
        <Text size="xs" c="dimmed">
          同一盟约可加入多个分类，规则在所有分类中共享。抽中保护与永久免疫优先；普通规则跨分类联合判定。
        </Text>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          className={styles.disable}
          onClick={() =>
            store.updateSeason(store.activeSeasonId!, (latest) => {
              const banConfig = { ...latest.banConfig }
              delete banConfig.classification
              return { ...latest, banConfig }
            })
          }
        >
          关闭分类规则，使用原版 normal
        </Button>
      </Stack>
    </CollabEditingProvider>
  )
}

function CategoryEditor({
  store,
  classification,
  categoryId,
}: {
  store: DataStore
  classification: BondClassification
  categoryId: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('any')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchRule, setBatchRule] = useState<BondBanRule>('all')
  const [adding, setAdding] = useState(false)
  const [addIds, setAddIds] = useState<string[]>([])
  const [addDropdown, setAddDropdown] = useState(false)
  const [addRule, setAddRule] = useState<string>(categoryId === 'core' ? 'all' : 'keep')
  const { users, currentUserId, currentModule } = useCollab()
  const membership = useCollabField('banConfig.classification', `classes.${categoryId}.bondIds`)
  const data = store.activeSeason!.data
  const category = classification.classes[categoryId]
  const members = [...new Set(category.bondIds)]
  const rule = (id: string) => classification.bondRules[id] ?? 'normal'
  const ruleLocked = (id: string) =>
    users.some(
      (user) =>
        user.userId !== currentUserId &&
        user.module === currentModule &&
        user.focusId === 'banConfig.classification' &&
        user.focusField === `bondRules.${id}`,
    )
  const editable = members.filter((id) => !ruleLocked(id))
  const selected = selectedIds.filter((id) => editable.includes(id))
  const query = search.trim().toLocaleLowerCase()
  const visible = members.filter(
    (id) =>
      (!query || `${data.bondInfoDict[id]?.name ?? ''} ${id}`.toLocaleLowerCase().includes(query)) &&
      (filter === 'any' || rule(id) === filter),
  )
  const visibleEditable = visible.filter((id) => !ruleLocked(id))
  const releaseIds = members.filter((id) => rule(id) === 'release')
  const legacyImmune = resolveLegacyBanConfig(data).immuneBonds
  const excluded = members.filter((id) => ['ignore', 'immune'].includes(rule(id)) || legacyImmune.includes(id))
  const candidateCount = members.length - excluded.length
  const addOptions = Object.values(data.bondInfoDict)
    .filter((bond) => !members.includes(bond.bondId))
    .map((bond) => ({ value: bond.bondId, label: `${bond.name} (${bond.bondId})` }))
  const applyRules = (targets: string[], value: BondBanRule) => {
    const editableIds = targets.filter((id) => !ruleLocked(id))
    patchClassification(store, (config, latest) => {
      const currentMembers = config.classes[categoryId]?.bondIds ?? []
      for (const id of editableIds)
        if (currentMembers.includes(id) && Object.hasOwn(latest.bondInfoDict, id)) config.bondRules[id] = value
    })
  }
  return (
    <Stack gap="xs" className={styles.category}>
      <div className={styles.settings}>
        <CTextInput
          size="xs"
          label="分类名称"
          collabField={`classes.${categoryId}.name`}
          value={category.name}
          onChange={(e) => {
            const name = e.currentTarget.value
            if (name.trim())
              patchClassification(store, (config) => {
                if (config.classes[categoryId]) config.classes[categoryId].name = name
              })
          }}
        />
        <CNumberInput
          size="xs"
          label="抽选数量"
          collabField={`classes.${categoryId}.drawCount`}
          min={0}
          allowDecimal={false}
          value={category.drawCount}
          onChange={(value) =>
            patchClassification(store, (config) => {
              if (config.classes[categoryId]) config.classes[categoryId].drawCount = Number(value) || 0
            })
          }
        />
        <div className={styles.categoryActions}>
          <Popover opened={adding} onChange={setAdding} position="bottom-end" width={320}>
            <Popover.Target>
              <Button
                size="xs"
                variant="light"
                disabled={membership.readOnly}
                onClick={() => setAdding((v) => !v)}
                leftSection={<IconPlus size={14} />}
              >
                添加盟约
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <MultiSelect
                  label="选择要加入的盟约"
                  searchable
                  clearable
                  comboboxProps={{ withinPortal: false }}
                  dropdownOpened={addDropdown}
                  onDropdownOpen={() => setAddDropdown(true)}
                  onDropdownClose={() => setAddDropdown(false)}
                  onOptionSubmit={() => setAddDropdown(false)}
                  data={addOptions}
                  value={addIds}
                  onChange={setAddIds}
                  nothingFoundMessage="没有可加入的盟约"
                />
                <Select
                  label="加入时规则"
                  comboboxProps={{ withinPortal: false }}
                  data={[{ value: 'keep', label: '保留各盟约当前规则' }, ...BOND_RULE_OPTIONS]}
                  value={addRule}
                  onChange={(value) => {
                    if (value) setAddRule(value)
                  }}
                />
                <Text size="xs" c="dimmed">
                  修改规则也会影响该盟约所属的其他分类。
                </Text>
                <Button
                  size="xs"
                  disabled={!addIds.length || membership.readOnly || (addRule !== 'keep' && addIds.some(ruleLocked))}
                  onClick={() => {
                    patchClassification(store, (config, latest) => {
                      const current = config.classes[categoryId]
                      if (!current) return
                      const known = addIds.filter((id) => Object.hasOwn(latest.bondInfoDict, id))
                      current.bondIds = [...new Set([...current.bondIds, ...known])]
                      if (addRule !== 'keep') for (const id of known) config.bondRules[id] = addRule as BondBanRule
                    })
                    setAddIds([])
                    setAdding(false)
                  }}
                >
                  加入 {addIds.length} 个盟约
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
          {!['core', 'minor'].includes(categoryId) && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              disabled={membership.readOnly}
              onClick={() =>
                patchClassification(store, (config) => {
                  delete config.classes[categoryId]
                })
              }
            >
              删除分类
            </Button>
          )}
        </div>
      </div>
      <Group gap={6} wrap="wrap" aria-label="当前分类规则统计">
        <Text size="xs" c="dimmed">
          {members.length} 个成员 · 最多可抽 {candidateCount} 个，模式另行筛选
        </Text>
        {BOND_RULE_OPTIONS.map((option) => {
          const count = members.filter((id) => rule(id) === option.value).length
          return count ? (
            <Badge key={option.value} size="sm" variant="light" color={RULE_COLORS[option.value as BondBanRule]}>
              {option.label} {count}
            </Badge>
          ) : null
        })}
      </Group>
      {categoryId === 'core' && category.drawCount > 0 && releaseIds.length > 0 && (
        <Alert color="orange" title="核心池内仍有抽中保护规则" py="xs">
          <Group gap="xs" justify="space-between">
            <Text size="xs">
              {releaseIds.map((id) => data.bondInfoDict[id]?.name ?? id).join('、')}会占用抽选名额并保护成员，抽{' '}
              {category.drawCount} 个不保证禁用 {category.drawCount} 个。
            </Text>
            <Button
              size="xs"
              color="orange"
              variant="light"
              disabled={releaseIds.some(ruleLocked)}
              onClick={() => applyRules(releaseIds, 'all')}
            >
              将这 {releaseIds.length} 个改为抽中禁用
            </Button>
          </Group>
        </Alert>
      )}
      {category.drawCount > candidateCount && (
        <Alert color="orange" py="xs">
          抽选数超过当前可抽成员，候选不足时会少抽；忽略、永久免疫和旧排除名单中的盟约不参与抽选。
        </Alert>
      )}
      <div className={styles.filters}>
        <TextInput
          size="xs"
          placeholder="搜索盟约名称或 ID"
          aria-label="搜索分类成员"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
        />
        <Select
          size="xs"
          aria-label="按规则筛选成员"
          value={filter}
          onChange={(value) => {
            if (value) setFilter(value)
          }}
          data={[{ value: 'any', label: '全部规则' }, ...BOND_RULE_OPTIONS]}
        />
      </div>
      <div className={styles.batchBar}>
        <Checkbox
          size="xs"
          label={`全选当前结果（${visible.length}）`}
          checked={visibleEditable.length > 0 && visibleEditable.every((id) => selected.includes(id))}
          indeterminate={
            visibleEditable.some((id) => selected.includes(id)) && !visibleEditable.every((id) => selected.includes(id))
          }
          disabled={!visibleEditable.length}
          onChange={(e) => {
            const checked = e.currentTarget.checked
            setSelectedIds((previous) =>
              checked
                ? [...new Set([...previous, ...visibleEditable])]
                : previous.filter((id) => !visibleEditable.includes(id)),
            )
          }}
        />
        <div className={styles.batchActions}>
          <Select
            size="xs"
            aria-label="批量设置规则"
            data={BOND_RULE_OPTIONS}
            value={batchRule}
            onChange={(value) => {
              if (value) setBatchRule(value as BondBanRule)
            }}
          />
          <Button size="xs" disabled={!selected.length} onClick={() => applyRules(selected, batchRule)}>
            应用到已选 {selected.length} 项
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            disabled={!selectedIds.length}
            onClick={() => setSelectedIds([])}
          >
            清空选择
          </Button>
        </div>
      </div>
      {selected.some((id) => !visible.includes(id)) && (
        <Text size="xs" c="orange">
          已选中 {selected.length} 项，其中 {selected.filter((id) => !visible.includes(id)).length}{' '}
          项被当前筛选隐藏；应用会同时修改这些已选项。
        </Text>
      )}
      <div className={styles.memberViewport}>
        <div className={styles.memberGrid}>
          {visible.map((id) => (
            <div key={id} className={styles.member} data-selected={selected.includes(id) || undefined}>
              <div className={styles.memberHeading}>
                <Checkbox
                  size="xs"
                  disabled={ruleLocked(id)}
                  checked={selected.includes(id)}
                  aria-label={`选择${data.bondInfoDict[id]?.name ?? id}`}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked
                    setSelectedIds((previous) =>
                      checked ? [...new Set([...previous, id])] : previous.filter((value) => value !== id),
                    )
                  }}
                  label={
                    <span className={styles.identity}>
                      <span className={styles.name} title={data.bondInfoDict[id]?.name}>
                        {data.bondInfoDict[id]?.name ?? id}
                      </span>
                      <span className={styles.id} title={id}>
                        {id}
                      </span>
                    </span>
                  }
                />
                <Tooltip label="从当前分类移除，保留盟约规则">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    aria-label={`从分类移除${data.bondInfoDict[id]?.name ?? id}`}
                    disabled={membership.readOnly}
                    onClick={() => {
                      patchClassification(store, (config) => {
                        const current = config.classes[categoryId]
                        if (current) current.bondIds = current.bondIds.filter((value) => value !== id)
                      })
                      setSelectedIds((previous) => previous.filter((value) => value !== id))
                    }}
                  >
                    <IconX size={13} />
                  </ActionIcon>
                </Tooltip>
              </div>
              <CSelect
                size="xs"
                aria-label={`${data.bondInfoDict[id]?.name ?? id}的禁用规则`}
                collabField={`bondRules.${id}`}
                data={BOND_RULE_OPTIONS}
                value={rule(id)}
                leftSection={
                  <span
                    className={styles.ruleDot}
                    style={{ background: `var(--mantine-color-${RULE_COLORS[rule(id)]}-5)` }}
                  />
                }
                onChange={(value) => {
                  if (value) applyRules([id], value as BondBanRule)
                }}
              />
            </div>
          ))}
          {!visible.length && (
            <Text size="sm" c="dimmed" className={styles.empty}>
              {members.length
                ? '没有匹配的盟约，试试清空搜索或切换规则筛选。'
                : '当前分类还没有成员，点击“添加盟约”开始配置。'}
            </Text>
          )}
        </div>
      </div>
    </Stack>
  )
}

export function BondClassificationFields({ store, bondId }: { store: DataStore; bondId: string }) {
  const ruleField = useCollabField('banConfig.classification', `bondRules.${bondId}`)
  const data = store.activeSeason?.data
  if (!data) return null
  const { classification } = inspectBondClassification(data)
  if (!classification)
    return (
      <Text size="xs" c="dimmed">
        启用分类规则后可设置归类与规则 tag。
      </Text>
    )
  return (
    <CollabEditingProvider itemId="banConfig.classification">
      <Stack gap="xs">
        <CMultiSelect
          label="所属盟约类别"
          collabField={`membership.${bondId}`}
          data={Object.entries(classification.classes).map(([id, category]) => ({ value: id, label: category.name }))}
          value={Object.keys(classification.classes).filter((id) =>
            classification.classes[id].bondIds.includes(bondId),
          )}
          onChange={(values) =>
            patchClassification(store, (config) => {
              for (const [id, category] of Object.entries(config.classes)) {
                category.bondIds = category.bondIds.filter((member) => member !== bondId)
                if (values.includes(id)) category.bondIds.push(bondId)
              }
            })
          }
        />
        <CSelect
          label="抽选后的规则"
          collabField={`bondRules.${bondId}`}
          data={BOND_RULE_OPTIONS}
          value={classification.bondRules[bondId] ?? 'normal'}
          onChange={(value) => {
            if (value)
              patchClassification(store, (config) => {
                config.bondRules[bondId] = value as BondBanRule
              })
          }}
        />
        {classification.classes.core.bondIds.includes(bondId) && classification.bondRules[bondId] === 'release' && (
          <Alert color="orange" py="xs">
            <Text size="xs">此盟约在核心池中，当前抽中后会保护成员，并占用抽选名额。</Text>
            <Button
              size="xs"
              variant="light"
              color="orange"
              mt={6}
              disabled={ruleField.readOnly}
              onClick={() =>
                patchClassification(store, (config) => {
                  config.bondRules[bondId] = 'all'
                })
              }
            >
              改为抽中禁用
            </Button>
          </Alert>
        )}
        <Text size="xs" c="dimmed">
          未抽中的 normal 盟约仍阻挡禁用；ignore 不阻挡，immune 始终保护成员。禁用只影响供应。
        </Text>
      </Stack>
    </CollabEditingProvider>
  )
}
