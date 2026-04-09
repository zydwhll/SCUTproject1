// 云函数入口文件
const cloud = require('wx-server-sdk');
// 引入node-xlsx库处理Excel生成
const xlsx = require('node-xlsx');
const fs = require('fs'); // 云函数内置fs模块，无需额外安装
const path = require('path'); // 云函数内置path模块
// 初始化云开发
cloud.init();
// 获取数据库实例
const db = cloud.database();
// 定义集合名称
const COLLECTION_NAME = 'users';

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 1. 校验入参
    const { id } = event;
    if (!id) {
      return {
        success: false,
        errMsg: '缺少必要参数：患者ID'
      };
    }

    // 2. 从数据库获取患者信息
    const userRes = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!userRes.data) {
      return {
        success: false,
        errMsg: '未找到该患者信息'
      };
    }
    const user = userRes.data;
    const { name, age, boneAge, height, weight, timerRecords = [] } = user;

    // 3. 构建Excel数据结构
    const excelData = [];
    // 表头
    const header = ["姓名", "年龄", "骨龄", "身高(cm)", "体重(kg)", "次数", "持续时长 (min)"];
    excelData.push(header);

    // 处理数据行
    if (timerRecords.length > 0) {
      // 有治疗记录的情况
      timerRecords.forEach((record, index) => {
        const row = [];
        if (index === 0) {
          // 第一行数据：填充所有基础信息
          row.push(name || '');
          row.push(age || '');
          row.push(boneAge || '');
          row.push(height || '');
          row.push(weight || '');
          row.push(record.count || '');
          row.push(record.duration || '');
        } else {
          // 后续行：前5列留空
          row.push('');
          row.push('');
          row.push('');
          row.push('');
          row.push('');
          row.push(record.count || '');
          row.push(record.duration || '');
        }
        excelData.push(row);
      });
    } else {
      // 无治疗记录的情况
      const emptyRow = [
        name || '',
        age || '',
        boneAge || '',
        height || '',
        weight || '',
        "无记录",
        "无记录"
      ];
      excelData.push(emptyRow);
    }

    // 4. 生成Excel Buffer
    const buffer = xlsx.build([{
      name: '患者治疗记录', // Excel工作表名称
      data: excelData
    }]);

    // 5. 上传Excel文件到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `patient_excel/${id}_${Date.now()}.xlsx`, // 文件存储路径（唯一命名）
      fileContent: buffer // 文件二进制内容
    });

    if (!uploadRes.fileID) {
      return {
        success: false,
        errMsg: '文件上传失败'
      };
    }

    // 6. 返回成功结果（包含fileID）
    return {
      success: true,
      fileID: uploadRes.fileID,
      errMsg: 'Excel生成并上传成功'
    };

  } catch (err) {
    // 异常捕获
    console.error('生成Excel失败：', err);
    return {
      success: false,
      errMsg: `生成Excel失败：${err.message}`
    };
  }
};