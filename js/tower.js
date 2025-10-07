import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import fs from 'fs'
import path from 'path'

const towerApi = 'https://api.hakush.in/gi/data/tower.json'
const towerDetailApi = 'https://api.hakush.in/gi/data/zh/tower/'
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
}

const tplFilePath = './resources/tower/tower.html'

export class giTowerInfo extends plugin {
    constructor() {
        super({
            name: '原神深渊查询',
            dsc: '查询原神指定月份的深境螺旋信息',
            event: 'message',
            priority: 510,
            rule: [
                {
                    reg: '^#?(\\d{4})(\\d{2})\\s*(深渊|深境螺旋)$',
                    fnc: 'getTowerInfoByMonth'
                }
            ]
        })

        this.checkAndDownloadTemplate().catch(err => {
            logger.error(`初始化模板文件时发生未捕获的错误: ${err}`)
        })
    }

    async checkAndDownloadTemplate() {
        if (fs.existsSync(tplFilePath)) {
            return
        }

        const dirPath = path.dirname(tplFilePath)
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }

        const url = 'https://raw.xn--6rtu33f.top/kvcfdd/yunzai-js/refs/heads/main/html/tower.html'
        try {
            const response = await fetch(url, { headers, timeout: 10000 })
            if (!response.ok) {
                logger.error(`下载模板文件失败，HTTP状态: ${response.status}`)
                return
            }
            const htmlContent = await response.text()
            fs.writeFileSync(tplFilePath, htmlContent, 'utf-8')
            logger.info(`模板文件 tower.html 下载成功！`)
        } catch (error) {
            logger.error(`下载模板文件时遇到错误: ${error}`)
            logger.error('请检查网络连接或手动将模板文件放置到 ' + tplFilePath)
        }
    }

    async getTowerInfoByMonth(e) {
        if (!fs.existsSync(tplFilePath)) {
            await this.reply('深渊查询模板文件不存在，请联系机器人管理员检查后台日志。', false)
            return true
        }
        
        const match = e.msg.match(/^#?(\d{4})(\d{2})\s*(深渊|深境螺旋)$/)
        if (!match) return false

        const year = parseInt(match[1])
        const month = parseInt(match[2])

        if (month < 1 || month > 12) {
            await this.reply('请输入有效的月份（01-12）。', false)
            return
        }

        const dateStr = `${year}年${month}月`
        await this.reply(`正在查询，请稍候...`, false)

        try {
            logger.debug('正在获取深渊周期...')
            const periodInfo = await this.getTowerKeyByMonth(year, month)
            if (!periodInfo) {
                await this.reply(`暂无【${dateStr}】开始的深渊数据。`, false)
                return
            }
            logger.debug(`获取周期成功: ${periodInfo.key}`)

            logger.debug(`正在获取深渊详情(${periodInfo.key})...`)
            const towerDetail = await this.getTowerDetail(periodInfo.key)
            if (!towerDetail) {
                 await this.reply(`获取【${dateStr}】的深渊详情失败。`, false)
                 return
            }
            logger.debug('获取详情成功。')
            
            const renderData = this.prepareRenderData(towerDetail, dateStr, periodInfo.period)
            
            const data = {
                tplFile: tplFilePath,
                ...renderData
            }
            
            logger.debug('正在渲染图片...')
            const img = await puppeteer.screenshot('tower', data)

            if (img) {
                await this.reply(img, false)
                logger.info(`${dateStr} 深渊图片已发送。`)
            } else {
                await this.reply('深渊图片渲染失败，请检查后台日志。', false)
            }

        } catch (error) {
            logger.error(`查询过程中发生错误: ${error}`)
            await this.reply('查询深渊信息时发生错误，请查看控制台日志。', false)
        }

        return true
    }

    async getTowerKeyByMonth(targetYear, targetMonth) {
        const res = await fetch(towerApi, { headers })
        if (!res.ok) throw new Error(`API请求失败: ${res.statusText}`)
        const schedule = await res.json()
        const matches = []

        for (const key in schedule) {
            const period = schedule[key]
            const beginDate = new Date(period.live_begin)
            const beginYear = beginDate.getFullYear()
            const beginMonth = beginDate.getMonth() + 1

            if (beginYear === targetYear && beginMonth === targetMonth) {
                matches.push({ key, period })
            }
        }
        
        if (matches.length > 0) {
            matches.sort((a, b) => new Date(a.period.live_begin) - new Date(b.period.live_begin))
            return matches[0]
        }

        return null
    }

    async getTowerDetail(key) {
        const url = `${towerDetailApi}${key}.json`
        const res = await fetch(url, { headers })
        if (!res.ok) return null
        return await res.json()
    }
    
    prepareRenderData(data, queryDateStr, period) {
        const leyline = {
            name: data.Leyline.Name,
            desc: data.Leyline.Desc.replace(/<color=#F39000>/g, '<span class="highlight">').replace(/<\/color>/g, '</span>'),
            icon: `https://api.hakush.in/gi/UI/${data.Leyline.Icon}.webp`
        }

        const floor12 = data.Floor['12']
        let rooms = []
        let buff = ''

        if (floor12) {
            rooms = Object.entries(floor12.Room).map(([roomNum, roomData]) => {
                const processMonsters = (monsterList) => monsterList.map(m => ({
                    name: m.Name,
                    hp: `HP: ${Math.round(m.Hp)}`,
                    icon: `https://api.hakush.in/gi/UI/${m.Icon}.webp`
                }))

                const conds = roomData.Cond.map(c => c[1]).reverse()
                const header = `12-${roomNum} ${conds[2]}s/${conds[1]}s/${conds[0]}s Lv.${roomData.Level}`

                return {
                    header,
                    firstHalf: processMonsters(roomData.First),
                    secondHalf: processMonsters(roomData.Second)
                }
            })
            buff = floor12.Buff.join('<br>')
        }
        
        return {
            queryDateStr,
            begin: period.live_begin,
            end: period.live_end,
            leyline,
            buff,
            rooms
        }
    }
}