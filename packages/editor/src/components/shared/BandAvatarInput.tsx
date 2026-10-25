import { Group, Text } from '@mantine/core'
import { characterNameMap, getCharName } from '@autochess-editor/shared'
import { CAutocomplete } from '../collab/CollabInputs'

const AVATAR_PREFIX = 'native-avatar:'
const avatarOptions = Object.keys(characterNameMap)
  .filter(id => id.startsWith('char_'))
  .sort((a, b) => getCharName(a).localeCompare(getCharName(b)))

interface Props {
  value: string
  onChange(value: string): void
  collabField?: string
}

/** Use the chess editor's operator suggestions while preserving custom icon IDs. */
export function BandAvatarInput({ value, onChange, collabField = 'bandIconId' }: Props) {
  const avatarId = value.startsWith(AVATAR_PREFIX) ? value.slice(AVATAR_PREFIX.length) : null
  return (
    <>
      <CAutocomplete
        label="策略头像"
        collabField={collabField}
        description="新增策略可搜索干员名并选择，或输入干员 / 图标 ID；留空按名称匹配。原版策略沿用客户端自带图标。"
        placeholder="搜索干员名或输入头像配置..."
        value={avatarId ?? value}
        onChange={input => {
          const id = input.trim()
          onChange(id.length <= 128 && /^char_[A-Za-z0-9_#@-]+$/.test(id) ? AVATAR_PREFIX + id : input)
        }}
        data={avatarOptions}
        clearable
        limit={50}
        filter={({ options, search, limit }) => {
          const needle = search.trim().replace(/^native-avatar:/, '').toLocaleLowerCase()
          return options.filter(option => {
            if ('group' in option) return false
            return `${getCharName(option.value)} ${option.value}`.toLocaleLowerCase().includes(needle)
          }).slice(0, limit)
        }}
        renderOption={({ option }) => {
          const id = option.value
          return (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm">{getCharName(id)}</Text>
              <Text size="xs" c="dimmed" ff="monospace">{id}</Text>
            </Group>
          )
        }}
      />
      {avatarId && <Text size="xs" c="dimmed">已选干员：{getCharName(avatarId)}</Text>}
    </>
  )
}
