import cfg from '../../lib/config/config.js'

export class requestNotice extends plugin {
  constructor() {
    super({
      name: "好友群邀请通知",
      dsc: "发送好友申请和群邀请通知给主人",
      event: "request"
    })
    this.redisPrefix = 'Yz:request:'
    this.requestTimeout = 24 * 3600
  }

  async accept() {
    if (this.e.post_type !== 'request') return
    
    let msg = []
    const data = this.e
    let requestId = ''
    
    try {
      // 好友申请
      if (data.request_type == "friend") {
        let { user_id, comment, flag } = data
        requestId = `friend_${user_id}`
        await redis.set(`${this.redisPrefix}${requestId}`, JSON.stringify({
          type: 'friend',
          flag,
          time: Date.now()
        }), { EX: this.requestTimeout })
        
        // 获取申请人信息
        let info = await this.e.bot.sendApi("get_stranger_info", { 
          user_id,
          no_cache: true
        }).catch(() => ({ data: {} }))
        let nickname = info?.data?.nickname || "未知昵称"
        
        msg = [
          segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${user_id}`),
          `\n[通知(${this.e.self_id}) - 添加好友申请]`,
          `\n申请人账号：${user_id}`,
          `\n申请人昵称：${nickname}`,
          `\n附加信息：${comment || "无"}`,
          `\n----------------`,
          '\n可发送 #同意好友' + user_id + ' 或 #拒绝好友' + user_id + ' 进行处理'
        ]
      }
      // 群邀请
      else if (data.request_type == "group" && data.sub_type == "invite") {
        let { group_id, user_id, flag } = data
        requestId = `group_${group_id}`
        await redis.set(`${this.redisPrefix}${requestId}`, JSON.stringify({
          type: 'group',
          flag,
          time: Date.now()
        }), { EX: this.requestTimeout })
        
        // 获取用户和群信息
        let [userInfo, groupInfo] = await Promise.all([
          this.e.bot.sendApi("get_stranger_info", { 
            user_id, 
            no_cache: true 
          }).catch(() => ({ data: {} })),
          this.e.bot.sendApi("get_group_info", { 
            group_id,
            no_cache: true 
          }).catch(() => ({ data: {} }))
        ])
        
        let nickname = userInfo?.data?.nickname || "未知昵称"
        let groupName = groupInfo?.data?.group_name || "未知群名"
        
        msg = [
          segment.image(`https://p.qlogo.cn/gh/${group_id}/${group_id}/100`),
          `\n[通知(${this.e.self_id}) - 群邀请]`,
          `\n群号：${group_id}`,
          `\n群名：${groupName}`,
          `\n邀请人账号：${user_id}`,
          `\n邀请人昵称：${nickname}`,
          `\n----------------`,
          '\n可发送 #同意群邀请' + group_id + ' 或 #拒绝群邀请' + group_id + ' 进行处理'
        ]
      }

      if (msg.length > 0) {
        logger.mark(`[请求通知]${this.e.logText}`)
        
        // 给所有主人发送消息
        await Promise.all(
          (cfg.master[this.e.self_id] || []).map(masterId =>
            this.e.bot.pickFriend(masterId).sendMsg(msg).catch(err => {
              logger.error(`发送通知给主人${masterId}失败:`, err)
            })
          )
        )
      }
    } catch (err) {
      logger.error(`处理请求通知失败:`, err)
    }
  }
}

export class requestHandler extends plugin {
  constructor() {
    super({
      name: "处理好友群邀请",
      dsc: "处理好友申请和群邀请",
      event: "message",
      rule: [{
        reg: "^#(同意|拒绝)(好友|群邀请)\\s*([0-9]+)$",
        fnc: "handleRequest"
      }]
    })
    this.redisPrefix = 'Yz:request:'
  }

  async handleRequest() {
    if (!this.e.isMaster) return false
    
    const match = this.e.msg.match(/^#(同意|拒绝)(好友|群邀请)\s*([0-9]+)$/)
    if (!match) return false
    
    const [, action, type, id] = match
    const approve = action === '同意'
    const requestId = type === '好友' ? `friend_${id}` : `group_${id}`
    const requestData = await redis.get(`${this.redisPrefix}${requestId}`)
    if (!requestData) {
      await this.reply('未找到相关请求或请求已过期')
      return false
    }
    
    try {
      const request = JSON.parse(requestData)

      try {
        if (request.type === 'friend') {
          await this.e.bot.sendApi('set_friend_add_request', {
            flag: request.flag,
            approve: approve
          })
        } else {
          await this.e.bot.sendApi('set_group_add_request', {
            flag: request.flag,
            sub_type: 'invite',
            approve: approve,
            reason: ''
          })
        }
      } catch (err) {
        if (err.message?.includes('请求已经被处理')) {
          await redis.del(`${this.redisPrefix}${requestId}`)
          await this.reply(`该${type}请求已被处理过`)
          return false
        }
        throw err
      }

      await redis.del(`${this.redisPrefix}${requestId}`)
      await this.reply(`已${action}${type === '好友' ? '好友申请' : '群邀请'}`)
      return true
    } catch (err) {
      logger.error(`处理${type}${action}失败:`, err)
      await this.reply(`${action}失败：${err.message}`)
      return false
    }
  }
}