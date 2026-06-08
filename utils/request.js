const app = getApp()

function uniqueBaseUrls() {
  const urls = [
    app.globalData.baseUrl,
    ...(app.globalData.apiBaseUrls || [])
  ].filter(Boolean)
  return Array.from(new Set(urls))
}

function isNetworkError(error) {
  const errMsg = error && error.errMsg ? error.errMsg : ''
  return errMsg.includes('timeout') || errMsg.includes('request:fail')
}

function doWxRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    })
  })
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code)
          return
        }
        reject(res)
      },
      fail: reject
    })
  })
}

async function doRequestWithBaseUrl(path, options) {
  let lastError = null
  for (const baseUrl of uniqueBaseUrls()) {
    const url = baseUrl + path
    try {
      const res = await doWxRequest({ ...options, url })
      if (baseUrl !== app.globalData.baseUrl) {
        console.warn('[api base switched]', app.globalData.baseUrl, '->', baseUrl)
        app.globalData.baseUrl = baseUrl
        app.globalData.wsBaseUrl = baseUrl.replace(/^http/, 'ws')
      }
      return res
    } catch (e) {
      lastError = e
      if (!isNetworkError(e)) {
        throw e
      }
      console.warn('[request base failed]', url, e.errMsg || e)
    }
  }
  throw lastError || new Error('网络异常')
}

async function loginSilently() {
  const code = await wxLogin()
  console.log('[login] GET /user/mock-login', { code })

  const loginRes = await doRequestWithBaseUrl('/user/mock-login', {
    method: 'GET',
    timeout: 15000,
    data: { code }
  })

  const body = loginRes.data
  if (body && body.code === 200 && body.data && body.data.token) {
    wx.setStorageSync('token', body.data.token)
    wx.setStorageSync('userInfo', body.data.user)
    console.log('[login] token ready')
    return body.data
  }

  throw body || loginRes
}

function needToken(url) {
  return url.startsWith('/order/') || url.startsWith('/reservation/')
}

function buildHeader(options, token) {
  const header = {
    'Content-Type': 'application/json',
    ...(options.header || {})
  }
  if (token) {
    header.Authorization = token
  }
  return header
}

async function requestOnce(options, token) {
  const header = buildHeader(options, token)

  console.log('[request]', options.method || 'GET', options.url, options.data || {})

  const res = await doRequestWithBaseUrl(options.url, {
    method: options.method || 'GET',
    timeout: options.timeout || 15000,
    data: options.data || {},
    header
  })

  const body = res.data
  if (body && body.code === 200) {
    return body.data
  }

  console.error('[request error]', options.url, body)
  throw body || res
}

async function request(options) {
  let token = wx.getStorageSync('token')

  if (!token && needToken(options.url)) {
    try {
      const loginData = await loginSilently()
      token = loginData.token
    } catch (e) {
      console.error('[login fail]', e)
      wx.showToast({ title: '请先登录', icon: 'none' })
      throw e
    }
  }

  try {
    return await requestOnce(options, token)
  } catch (e) {
    if (isNetworkError(e)) {
      const errMsg = e && e.errMsg ? e.errMsg : ''
      console.warn('[request retry]', options.url, errMsg)
      try {
        return await requestOnce(options, token)
      } catch (retryError) {
        console.error('[request fail]', options.url, retryError)
        wx.showToast({ title: '网络异常', icon: 'none' })
        throw retryError
      }
    }

    wx.showToast({
      title: String((e && e.message) || '请求失败').slice(0, 30),
      icon: 'none'
    })
    throw e
  }
}

module.exports = {
  request,
  loginSilently
}
