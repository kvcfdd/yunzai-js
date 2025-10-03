import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import fs from 'fs'
import path from 'path'

const towerApi = 'https://api.hakush.in/ww/data/tower.json'
const towerDetailApi = 'https://api.hakush.in/ww/data/zh/tower/'
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
}

const tplFilePath = './resources/tower/tower1.html'

const colorMap = {
    '导电': '#b45bff', 'electro': '#b45bff', 'Thunder': '#b45bff',
    '热熔': '#f0744e', 'pyro': '#f0744e', 'Fire': '#f0744e', 'Highlight': '#f0744e',
    '冷凝': '#41aefb', 'cryo': '#41aefb', 'Ice': '#41aefb',
    '气动': '#53f9b1', 'anemo': '#53f9b1', 'Wind': '#53f9b1',
    '衍射': '#f7e62f', 'geo': '#f7e62f', 'Light': '#f7e62f',
    '湮灭': '#e649a6', 'havoc': '#e649a6', 'Dark': '#e649a6',
}

const elementMeta = {
    1: { id: 1, name: '导电', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriThunder.webp', color: colorMap['导电'] },
    2: { id: 2, name: '热熔', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriFire.webp', color: colorMap['热熔'] },
    3: { id: 3, name: '冷凝', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriIce.webp', color: colorMap['冷凝'] },
    4: { id: 4, name: '气动', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriWind.webp', color: colorMap['气动'] },
    5: { id: 5, name: '衍射', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriLight.webp', color: colorMap['衍射'] },
    6: { id: 6, name: '湮灭', icon: 'https://api.hakush.in/ww/UI/UIResources/Common/Image/IconElementAttri/T_IconElementAttriDark.webp', color: colorMap['湮灭'] },
}


export class wwTowerInfo extends plugin {
    constructor() {
        super({
            name: '鸣潮深塔查询',
            dsc: '查询鸣潮指定月份的深塔信息',
            event: 'message',
            priority: 500,
            rule: [
                {
                    reg: '^/(\\d{4})(\\d{2})\\s*(深塔|深渊|逆境深塔)$',
                    fnc: 'getTowerInfoByMonth'
                }
            ]
        })

        this.checkAndDownloadTemplate().catch(err => {
            logger.error(`初始化模板时发生错误: ${err}`)
        })
    }

    async checkAndDownloadTemplate() {
        if (fs.existsSync(tplFilePath)) return

        logger.warn(`模板文件 ${tplFilePath} 不存在，将尝试从网络下载...`)
        const dirPath = path.dirname(tplFilePath)
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }

        const url = 'https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/html/tower1.html'

        try {
            const response = await fetch(url, { headers })
            if (!response.ok) {
                logger.error(`下载模板文件失败，HTTP状态: ${response.status}`)
                return
            }
            const htmlContent = await response.text()
            fs.writeFileSync(tplFilePath, htmlContent, 'utf-8')
            logger.info(`模板文件下载成功！`)
        } catch (error) {
            logger.error(`下载模板文件时遇到错误: ${error}`)
            logger.error(`请检查URL是否正确或手动将模板文件放置到 ${tplFilePath}`)
        }
    }

    async getTowerInfoByMonth(e) {
        if (!fs.existsSync(tplFilePath)) {
            await this.reply('深塔查询模板文件不存在，请联系机器人管理员检查后台日志。', true)
            return true
        }
        
        const match = e.msg.match(/^\/(\d{4})(\d{2})\s*(深塔|深渊|逆境深塔)$/)

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
            const matchedTowers = await this.getTowerKeysByMonth(year, month)
            if (!matchedTowers || matchedTowers.length === 0) {
                await this.reply(`暂无【${dateStr}】深塔数据。`, false)
                return
            }

            const towerDataPromises = matchedTowers.map(tower => this.getTowerDetail(tower.key))
            const towerDataArray = await Promise.all(towerDataPromises)
            const renderData = this.prepareRenderData(towerDataArray, dateStr)

            const data = {
                tplFile: tplFilePath,
                ...renderData
            }
            const img = await puppeteer.screenshot('tower', data)

            if (img) {
                await this.reply(img, false)
            } else {
                await this.reply('深塔图片渲染失败，请检查后台日志。', false)
            }

        } catch (error) {
            logger.error(`Error: ${error}`)
            await this.reply('查询深塔信息时发生错误，请查看控制台日志。', false)
        }

        return true
    }
    

    async getTowerKeysByMonth(targetYear, targetMonth) {
        const res = await fetch(towerApi, { headers })
        if (!res.ok) throw new Error(`API请求失败: ${res.statusText}`)
        const schedule = await res.json()
        const matches = []

        for (const key in schedule) {
            const period = schedule[key]
            const beginDate = new Date(period.begin)
            const beginYear = beginDate.getFullYear()
            const beginMonth = beginDate.getMonth() + 1

            if (beginYear === targetYear && beginMonth === targetMonth) {
                matches.push({ key, period })
            }
        }
        matches.sort((a, b) => new Date(a.period.begin) - new Date(b.period.begin))
        return matches
    }

    async getTowerDetail(key) {
        const url = `${towerDetailApi}${key}.json`
        const res = await fetch(url, { headers })
        if (!res.ok) throw new Error(`API请求失败: ${res.statusText}`)
        return await res.json()
    }

    cleanBuffDesc(desc) {
        let finalDesc = desc
        for (const [key, color] of Object.entries(colorMap)) {
            const regex = new RegExp(`<color=${key}>`, 'gi')
            finalDesc = finalDesc.replace(regex, `<span style="color: ${color}">`)
        }
        return finalDesc.replace(/<\/color>/g, '</span>')
    }

    prepareRenderData(towerDataArray, queryDateStr) {
        const schedules = towerDataArray.map(towerData => {
            const areas = Object.values(towerData.Area).map(areaData => {
                const floors = Object.values(areaData.Floor).map(floor => {
                    const monsterIcons = Object.values(floor.Monsters).map(m => {
                        const pathParts = m.Icon.split('/')
                        let fileName = pathParts[pathParts.length - 1]
                        fileName = fileName.split('.')[0]
                        
                        const finalPath = `/UI/UIResources/Common/Image/IconMonsterHead/${fileName}.webp`
                        
                        let hpString = ''

                        if (m.Try && m.TryGrowth && Object.keys(m.Try).length > 0) {
                            const lifeValues = Object.values(m.Try).map(tryChar => tryChar.Life)
                            const maxBaseLife = Math.max(...lifeValues)
                            const lifeMaxRatio = m.TryGrowth.LifeMaxRatio
                            const finalHp = Math.round(maxBaseLife * (lifeMaxRatio / 10000))

                            hpString = `HP: ${finalHp}`
                        }

                        return {
                            hp: hpString,
                            iconUrl: `https://api.hakush.in/ww${finalPath}`
                        }
                    })
                    
                    const buffs = Object.values(floor.Buffs).map(b => this.cleanBuffDesc(b.Desc))
                    const recommendElements = floor.RecommendElement.map(id => elementMeta[id] || null).filter(Boolean)

                    return { monsterIcons, buffs, recommendElements }
                })

                let headerStyle = ''
                const firstFloorElements = floors[0]?.recommendElements || []
                if (firstFloorElements.length === 1) {
                    headerStyle = `border-top: 4px solid ${firstFloorElements[0].color};`
                } else if (firstFloorElements.length >= 2) {
                    const color1 = firstFloorElements[0].color
                    const color2 = firstFloorElements[1].color
                    headerStyle = `border-width: 4px 0 0 0; border-style: solid; border-image: linear-gradient(to right, ${color1}, ${color2}) 1;`
                }

                return {
                    name: areaData.Floor['1']?.AreaName || '未知区域',
                    floors: floors,
                    headerStyle: headerStyle
                }
            })
            
            const order = {'残响之塔': 1, '深境之塔': 2, '回音之塔': 3}
            areas.sort((a,b) => (order[a.name] || 99) - (order[b.name] || 99))

            return {
                begin: towerData.Begin,
                end: towerData.End,
                areas: areas
            }
        })

        let beginDate = '', endDate = ''
        if (schedules.length > 0) {
            beginDate = schedules[0].begin
            endDate = schedules[schedules.length - 1].end
        }

        return {
            queryDateStr: queryDateStr,
            schedules: schedules,
            showPeriodHeader: schedules.length > 1,
            begin: beginDate,
            end: endDate,
            bg: `https://api.hakush.in/ww/bg/${Math.floor(Math.random() * 20) + 1}.webp`
        }
    }
}