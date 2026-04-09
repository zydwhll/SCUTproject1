// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取微信上下文
  const wxContext = cloud.getWXContext();
  // 返回openid等信息
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};