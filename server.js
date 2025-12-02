require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得指定地點的天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
const getWeatherByLocation = async (req, res) => {
  try {
    // 1. 從 Query Parameter 中獲取地點，例如: /api/weather?location=臺北市
    const locationName = req.query.location;

    // 檢查參數
    if (!locationName) {
      return res.status(400).json({
        error: "參數錯誤",
        message: "請提供 location 參數，例如: ?location=臺北市",
      });
    }

    // 檢查 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 呼叫 CWA API
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: locationName, // 使用動態傳入的地點
        },
      }
    );

    // 取得地點的天氣資料
    // 因為我們有指定 locationName，理論上陣列只會有一筆資料
    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        success: false,
        error: "查無資料",
        message: `找不到「${locationName}」的天氣資料，請確認縣市名稱是否正確。`,
      });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    // 解析天氣要素
    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "", // Wx
        rain: "",    // PoP
        minTemp: "", // MinT
        maxTemp: "", // MaxT
        comfort: "", // CI
        windSpeed: "", // WS (需要確認 API 是否包含此項，F-C0032-001 預設可能沒有 WS，需依實際回傳為主，若無則前端顯示N/A)
      };

      weatherElements.forEach((element) => {
        const timeSlot = element.time[i];
        if (!timeSlot) return;
        
        const value = timeSlot.parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            // 可以額外回傳 weatherValue 用於前端判斷 icon
            // forecast.weatherValue = value.parameterValue; 
            break;
          case "PoP":
            forecast.rain = value.parameterName; // 保持原始數字，前端再加 %
            break;
          case "MinT":
            forecast.minTemp = value.parameterName;
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName;
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          // 注意: F-C0032-001 標準回傳不包含風速 (WS)，若需風速可能需要改接其他 API 或確認氣象局文件。
          // 這裡先保留程式碼，若 API 有回傳則會 mapping。
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);
    // ... (錯誤處理保持不變)
    if (error.response) {
        return res.status(error.response.status).json({
          error: "CWA API 錯誤",
          message: error.response.data.message || "無法取得天氣資料",
          details: error.response.data,
        });
      }
      res.status(500).json({
        error: "伺服器錯誤",
        message: "無法取得天氣資料，請稍後再試",
      });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API (Neumorphism版)",
    endpoints: {
      weather: "/api/weather?location=縣市名稱",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 修改路由以接受通用查詢
app.get("/api/weather", getWeatherByLocation);

// ... (其餘 Error handling 保持不變)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      error: "伺服器錯誤",
      message: err.message,
    });
  });
  
  app.use((req, res) => {
    res.status(404).json({
      error: "找不到此路徑",
    });
  });

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作 (Neumorphism API)`);
  console.log(`📍 Port: ${PORT}`);
});