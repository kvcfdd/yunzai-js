import { Character } from '../miao-plugin/models/index.js'
import fs from 'node:fs'
import _ from 'lodash'

const _path = process.cwd().replace(/\\/g, '/')

const replace_list = [
  '极限',
  '核爆'
]

export class presetPanel extends plugin {
  constructor () {
    super({
      name: '预设面板',
      dsc: '角色预设面板查询与管理',
      event: 'message',
      priority: -10000,
      rule: [
        {
          reg: '^#?(刷新|更新|初始化)预设面板$',
          fnc: 'refreshPanelData',
          permission: 'master'
        }
      ]
    })
  }

  /**
   * 启动时自动执行一次数据刷新
   */
  async init () {
    await this.setupPanelData()
    logger.mark('预设面板数据已自动加载完成')
  }

  /**
   * 接受消息，进行关键词替换
   */
  async accept (e) {
    let reg = RegExp(replace_list.join('|'))
    if (!reg.test(e.msg) || /添加|删除|表情/.test(e.msg)) return false
    let msg = /换/.test(e.msg) ? e.msg.split('换') : [e.msg]
    if (replace_list.includes(msg[0])) return false

    let result = this._replace(msg)
    let Msg = result[0].replace(/#(星铁)?/g, '')

    if (reg.test(msg[0])) {
      let uid = Msg.match(/\d+/)
      let name = Msg.replace(uid, '')
      let char = Character.get(name.replace(/面板|圣遗物|伤害|武器/g, ''), e.isSr ? 'sr' : 'gs')
      if (!char && !/面板/.test(Msg)) return false
      result[0] = `#${name}${/面板|圣遗物|伤害|武器/.test(Msg) ? '' : '面板'}${uid}`
    }
    e.msg = msg.length > 1 ? result.slice(0).join('换') : result[0]
  }

  /**
   * 替换消息中的关键词为UID
   */
  _replace (msg) {
    let Msg = []
    msg.forEach(i => {
      let idx = replace_list.findIndex(k => i.includes(k))
      Msg.push(idx !== -1 ? i.replace(replace_list[idx], `10000000${idx}`) : i)
    })
    return Msg
  }

  /**
   * 由刷新命令触发
   */
  async refreshPanelData () {
    if (await this.setupPanelData()) {
      await this.e.reply('预设面板数据刷新成功！', true)
    } else {
      await this.e.reply('预设面板数据刷新失败，请检查后台日志。', true)
    }
    return true
  }

  async setupPanelData () {
    const fileSources = [
      {
        source: `${_path}/resources/presetPanelData/gs`,
        target: `${_path}/data/PlayerData/gs`,
        type: '.json',
        game: 'gs',
        downloads: ['100000000.json', '100000001.json']
      }, {
        source: `${_path}/resources/presetPanelData/sr`,
        target: `${_path}/data/PlayerData/sr`,
        type: '.json',
        game: 'sr',
        downloads: ['100000000.json']
      }
    ]

    const baseUrl = 'https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/json/'

    try {
      for (const v of fileSources) {
        // 如果不存在则创建并下载文件
        if (!fs.existsSync(v.source)) {
          logger.mark(`源目录不存在，正在创建并下载: ${v.source}`)
          fs.mkdirSync(v.source, { recursive: true })

          for (const file of v.downloads) {
            const url = `${baseUrl}${v.game}/${file}`
            const destPath = `${v.source}/${file}`
            try {
              const res = await fetch(url)
              if (res.ok) {
                const content = await res.text()
                fs.writeFileSync(destPath, content)
                logger.mark(`已成功下载文件: ${file}`)
              } else {
                logger.error(`下载预设文件 ${file} 失败: ${res.status} ${res.statusText}`)
              }
            } catch (err) {
              logger.error(`下载预设文件 ${file} 时出现网络错误:`, err)
            }
          }
        }

        if (!fs.existsSync(v.target)) {
          fs.mkdirSync(v.target, { recursive: true })
        }

        if (!fs.existsSync(v.source)) {
          logger.warn(`源目录仍不存在，跳过复制: ${v.source}`)
          continue
        }

        const filesToCopy = fs.readdirSync(v.source).filter(file => file.endsWith(v.type))

        if (filesToCopy.length === 0) {
          logger.warn(`源目录 ${v.source} 中无可复制的 .json 文件，跳过。`)
          continue
        }

        for (const f of filesToCopy) {
          fs.copyFileSync(`${v.source}/${f}`, `${v.target}/${f}`)
        }
        logger.mark(`${v.game === 'gs' ? '原神' : '星铁'} 预设数据已复制 ${filesToCopy.length} 个文件。`)
      }
      return true
    } catch (error) {
      logger.error('处理预设数据文件时出错:', error)
      return false
    }
  }
}