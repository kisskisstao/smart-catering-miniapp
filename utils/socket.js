const app = getApp()

let socketOpen = false
let reconnectTimer = null
let currentTask = null

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function connectOrderSocket(orderId, handlers = {}, options = {}) {
  const { reconnect = true, reconnectDelay = 3000 } = options
  clearReconnectTimer()

  const url = `${app.globalData.wsBaseUrl}/ws/order/${orderId}`
  currentTask = wx.connectSocket({ url })

  wx.onSocketOpen(() => {
    socketOpen = true
    if (handlers.open) handlers.open()
  })

  wx.onSocketMessage((res) => {
    try {
      if (handlers.message) handlers.message(JSON.parse(res.data))
    } catch (e) {
      if (handlers.message) handlers.message(res.data)
    }
  })

  wx.onSocketError((err) => {
    socketOpen = false
    if (handlers.error) handlers.error(err)
  })

  wx.onSocketClose((res) => {
    socketOpen = false
    if (handlers.close) handlers.close(res)
    if (reconnect && orderId) {
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        connectOrderSocket(orderId, handlers, options)
      }, reconnectDelay)
    }
  })

  return currentTask
}

function connectTableStatusSocket(storeId = 1, handlers = {}, options = {}) {
  const { reconnect = true, reconnectDelay = 3000 } = options
  clearReconnectTimer()

  const url = `${app.globalData.wsBaseUrl}/ws/table/status?storeId=${storeId}`
  currentTask = wx.connectSocket({ url })

  wx.onSocketOpen(() => {
    socketOpen = true
    if (handlers.open) handlers.open()
  })

  wx.onSocketMessage((res) => {
    try {
      if (handlers.message) handlers.message(JSON.parse(res.data))
    } catch (e) {
      if (handlers.message) handlers.message(res.data)
    }
  })

  wx.onSocketError((err) => {
    socketOpen = false
    if (handlers.error) handlers.error(err)
  })

  wx.onSocketClose((res) => {
    socketOpen = false
    if (handlers.close) handlers.close(res)
    if (reconnect && storeId) {
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        connectTableStatusSocket(storeId, handlers, options)
      }, reconnectDelay)
    }
  })

  return currentTask
}

function closeSocket() {
  clearReconnectTimer()
  if (!socketOpen && !currentTask) return
  wx.closeSocket()
  socketOpen = false
  currentTask = null
}

module.exports = {
  connectOrderSocket,
  connectTableStatusSocket,
  closeSocket
}
