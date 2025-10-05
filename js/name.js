import plugin from '../../lib/plugins/plugin.js'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

// char_alias.json 文件路径
const USER_DEFINED_CHAR_ALIAS_PATH = 'gsuid_core/data/WutheringWavesUID/alias/char_alias.json'

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const mkdirAsync = promisify(fs.mkdir)
const statAsync = promisify(fs.stat)

async function pathExists(targetPath) {
  try {
    await statAsync(targetPath)
    return true
  } catch (error) {
    if (error.name === 'ENOENT') {
      return false
    }
    throw error // 其他错误则抛出
  }
}

export class CharAliasEditor extends plugin {
  constructor () {
    super({
      name: 'WutheringWavesUID角色别名编辑器',
      dsc: '通过指令修改WutheringWavesUID的角色别名',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^ww添加(.*)别名(.*)$',
          fnc: 'addCharAlias',
          permission: 'master'
        },
        {
          reg: '^ww移除(.*)别名(.*)$',
          fnc: 'deleteCharAlias',
          permission: 'master'
        }
      ]
    })
  }

  // 加载别名文件
  async _loadAliases (e) {
    if (USER_DEFINED_CHAR_ALIAS_PATH === 'gsuid_core/data/WutheringWavesUID/alias/char_alias.json') {
        await e.reply('错误：插件未配置别名文件路径，请联系机器人管理员检查插件设置。')
        return null
    }

    if (!await pathExists(USER_DEFINED_CHAR_ALIAS_PATH)) {
      logger.warn(`指定的别名文件不存在: ${USER_DEFINED_CHAR_ALIAS_PATH}`)
      const dirPath = path.dirname(USER_DEFINED_CHAR_ALIAS_PATH)
      if (!await pathExists(dirPath)) {
        try {
          await mkdirAsync(dirPath, { recursive: true })
          logger.info(`已尝试创建目录: ${dirPath}。请在该目录下手动创建空的JSON文件 '{}'，文件名为 char_alias.json (或您配置的名称)。`)
          if (e) await e.reply(`错误：指定的别名文件不存在，但已尝试创建其所在目录。\n请在 ${dirPath} 下手动创建空的JSON文件 '{}' 并命名为 ${path.basename(USER_DEFINED_CHAR_ALIAS_PATH)}。`)
        } catch (err) {
          logger.error(`创建目录失败: ${dirPath}`, err)
          if (e) await e.reply(`创建目录 ${dirPath} 失败，请检查权限或手动创建。文件 ${path.basename(USER_DEFINED_CHAR_ALIAS_PATH)} 也需要手动创建。`)
        }
      } else {
         if (e) await e.reply(`错误：指定的别名文件 ${USER_DEFINED_CHAR_ALIAS_PATH} 不存在。\n请检查路径或手动创建该文件 (初始内容可为 '{}')。`)
      }
      return null
    }

    try {
      const fileContent = await readFileAsync(USER_DEFINED_CHAR_ALIAS_PATH, 'utf8')
      const jsonData = JSON.parse(fileContent)
      // 确保每个主键对应的都是数组
      for (const key in jsonData) {
        if (!Array.isArray(jsonData[key])) {
          logger.warn(`警告: 角色 "${key}" 的值不是一个数组，将尝试转换。原始值:`, jsonData[key])
          jsonData[key] = [String(jsonData[key])]
        }
      }
      return jsonData
    } catch (err) {
      logger.error(`读取或解析 ${USER_DEFINED_CHAR_ALIAS_PATH} 失败:`, err)
      if (e) await e.reply(`读取或解析别名文件失败，请检查文件格式或查看控制台日志。\n错误: ${err.message}`)
      return null
    }
  }

  // 保存别名文件
  async _saveAliases (aliases, e, successMsg = '别名文件已更新。') {
    try {
      await writeFileAsync(USER_DEFINED_CHAR_ALIAS_PATH, JSON.stringify(aliases, null, 2), 'utf8')
      logger.info(`${successMsg} 文件已更新: ${USER_DEFINED_CHAR_ALIAS_PATH}`)
      if (e) await e.reply(successMsg)
      return true
    } catch (err) {
      logger.error(`写入 ${USER_DEFINED_CHAR_ALIAS_PATH} 失败:`, err)
      if (e) await e.reply(`保存别名文件失败，请查看控制台日志。\n错误: ${err.message}`)
      return false
    }
  }

  // 根据输入查找主要角色名
  _findMainName (charAliases, targetNameInput) {
    for (const mainName in charAliases) {
      if (!Array.isArray(charAliases[mainName])) continue // 跳过非数组的值
      if (mainName === targetNameInput || charAliases[mainName].includes(targetNameInput)) {
        return mainName
      }
    }
    return null
  }

  // 添加别名的处理函数
  async addCharAlias (e) {
    const match = e.msg.match(this.rule[0].reg)
    if (!match) return false

    const targetNameInput = match[1].trim()
    const newAlias = match[2].trim()

    if (!targetNameInput) {
      await e.reply('请输入要添加别名的角色或现有别名。\n用法：ww添加[角色名/旧别名]别名[新别名]')
      return true
    }
    if (!newAlias) {
      await e.reply('请输入要添加的新别名。\n用法：ww添加[角色名/旧别名]别名[新别名]')
      return true
    }

    const charAliases = await this._loadAliases(e)
    if (!charAliases) return true

    const foundMainName = this._findMainName(charAliases, targetNameInput)

    if (!foundMainName) {
      if (targetNameInput === newAlias) {
        await e.reply(`不能将角色名 “${targetNameInput}” 添加为其自身的唯一新别名。如果想创建新角色条目，请确保新别名与角色主名不同，或手动编辑JSON。`)
        return true
      }
      logger.info(`未找到角色 “${targetNameInput}”，将尝试创建新条目并添加别名 “${newAlias}”。`)
      charAliases[targetNameInput] = [targetNameInput, newAlias]
       await this._saveAliases(charAliases, e, `已为新角色 “${targetNameInput}” 创建条目并添加别名：“${newAlias}”。`)
      return true
    }

    if (!Array.isArray(charAliases[foundMainName])) {
        charAliases[foundMainName] = []
    }

    if (charAliases[foundMainName].includes(newAlias)) {
      await e.reply(`“${newAlias}”已经是角色“${foundMainName}”的别名了。`)
      return true
    }

    charAliases[foundMainName].push(newAlias)
    await this._saveAliases(charAliases, e, `成功为角色“${foundMainName}”添加别名：“${newAlias}”。`)
    return true
  }

  async deleteCharAlias (e) {
    const match = e.msg.match(this.rule[1].reg)
    if (!match) return false

    const targetNameInput = match[1].trim()
    const aliasToDelete = match[2].trim()

    if (!targetNameInput) {
      await e.reply('请输入要移除其别名的角色或现有别名。\n用法：ww移除[角色名/旧别名]别名[要移除的别名]')
      return true
    }
    if (!aliasToDelete) {
      await e.reply('请输入要移除的别名。\n用法：ww移除[角色名/旧别名]别名[要移除的别名]')
      return true
    }

    const charAliases = await this._loadAliases(e)
    if (!charAliases) return true

    const foundMainName = this._findMainName(charAliases, targetNameInput)

    if (!foundMainName) {
      await e.reply(`未在别名文件中找到角色或别名：“${targetNameInput}”。无法移除其别名。`)
      return true
    }

    if (!Array.isArray(charAliases[foundMainName])) {
        await e.reply(`错误：角色“${foundMainName}”的数据格式不正确（非数组），无法移除别名。请检查JSON文件。`)
        return true
    }

    if (!charAliases[foundMainName].includes(aliasToDelete)) {
      await e.reply(`角色“${foundMainName}”没有名为“${aliasToDelete}”的别名。`)
      return true
    }

    if (aliasToDelete === foundMainName) {
        await e.reply(`操作被阻止：不能移除与角色主要名称 (“${foundMainName}”) 相同的别名。\n这个别名是该角色的核心标识，应始终保留在别名列表中。\n如果您想移除整个角色条目，请手动编辑JSON文件。`)
        return true
    }

    charAliases[foundMainName] = charAliases[foundMainName].filter(alias => alias !== aliasToDelete)

    if (charAliases[foundMainName].length === 0) {
      logger.warn(`角色“${foundMainName}”的别名列表在移除“${aliasToDelete}”后变为空。将自动添加其主要名称作为别名。`)
      charAliases[foundMainName].push(foundMainName)
      await this._saveAliases(charAliases, e, `成功从角色“${foundMainName}”的别名中移除了“${aliasToDelete}”。\n注意：别名列表因此变空，已自动将主要名称 “${foundMainName}” 添加回别名列表。`)
      return true
    }

    await this._saveAliases(charAliases, e, `成功从角色“${foundMainName}”的别名中移除了“${aliasToDelete}”。`)
    return true
  }
}
