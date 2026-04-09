// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 根据 action 执行不同操作：保存/查询
    if (event.action === 'save') {
      // 保存用户信息（根据openid唯一标识，不存在则新增，存在则更新）
      await db.collection('userInfo').doc(openid).set({
        data: {
          age: event.age,
          weight: event.weight,
          height: event.height,
          boneAge: event.boneAge,
        }
      })
      return {
        success: true,
        msg: '信息保存成功'
      }
    } else if (event.action === 'get') {
      // 查询用户信息
      const res = await db.collection('userInfo').doc(openid).get()
      return {
        success: true,
        data: res.data || {}
      }
    }
  } catch (err) {
    console.error('云函数执行失败：', err)
    return {
      success: false,
      msg: '操作失败：' + err.message
    }
  }
}