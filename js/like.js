export class like extends plugin {
  constructor() {
    super({
      name: "点赞",
      dsc: "机器人点赞",
      event: "message",
      priority: -10,
      rule: [
        {
          reg: "^#*(我要|给我)?(资料卡)?(点赞|赞我)$",
          fnc: "like",
        },
      ],
    })
    this.checkFriend = false // 是否检查用户是否是好友
  }

  async like(e) {
    let userId = e.user_id

    // 检查用户是否是好友
    if (this.checkFriend) {
      let isFriend = await (e.bot ?? Bot).fl.get(userId)
      if (!isFriend) {
        let msg = [
          `非好友不给赞☹️`,
          segment.image(`http://api.yujn.cn/api/pa.php?qq=${userId}`)
        ]
        e.reply(msg, true, { recallMsg: 60 })
        return
      }
    }

    let totalLiked = 0

    // 尝试最多5次点赞，每次点赞10次
    let success = false
    for (let i = 0; i < 5; i++) {
      let attempt = await e.bot.pickFriend(e.user_id).thumbUp(10)
      if (attempt.status === "ok") {
        totalLiked += 10
        if (totalLiked >= 50) {
          success = true
          break
        }
      } else {
        if (i === 0) {
          let msg = [
            `今天已经赞过啦笨蛋！`,
            segment.image(`http://api.yujn.cn/api/pa.php?qq=${userId}`)
          ]
          e.reply(msg, true, { recallMsg: 60 })
        }
        break
      }
    }

    if (success || totalLiked > 0) {
      let msg = [
        `我已经赞你${totalLiked}次,记得要回赞哦~`,
        segment.image(`http://api.yujn.cn/api/ju.php?qq=${userId}`)
      ]
      e.reply(msg, true, { recallMsg: 60 })
    }
  }
}