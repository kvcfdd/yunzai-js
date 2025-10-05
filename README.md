# yunzai-js

存放云崽机器人使用的小插件

**注：本库所有插件均仅考虑trss的OneBotv11标准**

- 原神深渊信息查询

```
curl -o plugins/example/tower.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/tower.js
```

使用示例：`#202510深渊`


- 鸣潮深塔信息查询

```
curl -o plugins/example/waves-tower.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/waves-tower.js
```

使用示例：`ww202510深塔`


- 好友申请/群邀请通知与处理

```
curl -o plugins/example/request.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/request.js
```

说明：收到好友申请与群邀请时会向主人发送通知，主人可使用命令处理


- QQ主页点赞

```
curl -o plugins/example/like.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/like.js
```

使用示例：`#赞我`


- 预设面板替换

```
curl -o plugins/example/presetPanel.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/presetPanel.js
```

**注意：如在使用梁氏插件请不要安装此插件，可能会导致梁氏的数据被覆盖**

说明：该插件参考梁氏插件编写，主要给不使用它的云崽提供预设面板变换，本人不会对预设面板进行更新，这里提供两个脚本供辅助自行更新预设面板

**使用前请先修改脚本内相关文件路径**

[原神预设面板更新](https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/python/100000000.py)

[星铁预设面板更新](https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/python/100000000-SR.py)


- WutheringWavesUID角色别称编辑

```
curl -o plugins/example/name.js https://raw.githubusercontent.com/kvcfdd/yunzai-js/refs/heads/main/js/name.js
```

说明：此为[GsCore](https://docs.sayu-bot.com)的[WutheringWavesUID](https://github.com/tyql688/WutheringWavesUID)插件辅助功能，实现使用命令添加/移除角色别称，重启GsCore生效

使用示例：`ww添加今汐别名汐汐` ， `ww移除今汐别名汐汐`


#### 赞助

* [爱发电](https://afdian.com/a/fzbot)
