const { request } = require('../../utils/request')
const socket = require('../../utils/socket')

const PAY_LIMIT_SECONDS = 15 * 60

const statusIndexMap = {
  PENDING_PAYMENT: 0,
  WAIT_ACCEPT: 1,
  COOKING: 2,
  COMPLETED: 3,
  CANCELLED: -1
}

const statusTextMap = {
  PENDING_PAYMENT: '待支付',
  WAIT_ACCEPT: '商家待接单',
  COOKING: '制作中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

function formatRemain(seconds) {
  const safe = Math.max(seconds, 0)
  const min = String(Math.floor(safe / 60)).padStart(2, '0')
  const sec = String(safe % 60).padStart(2, '0')
  return `${min}:${sec}`
}

Page({
  data: {
    orderId: null,
    fromPayment: false,
    order: null,
    socketStatus: '实时状态连接中',
    remainText: formatRemain(PAY_LIMIT_SECONDS),
    expired: false,
    cancelling: false,
    steps: [
      { status: 'PENDING_PAYMENT', text: '待支付' },
      { status: 'WAIT_ACCEPT', text: '已支付' },
      { status: 'COOKING', text: '制作中' },
      { status: 'COMPLETED', text: '已完成' }
    ],
    activeStep: 0,
    loading: false
  },

  onLoad(options) {
    this.setData({
      orderId: Number(options.orderId),
      fromPayment: options.from === 'payment'
    })
    this.loadDetail()
    this.connectSocket()
  },

  onShow() {
    if (this.data.orderId) {
      this.loadDetail(false)
    }
  },

  onUnload() {
    this.clearTimer()
    socket.closeSocket()
  },

  async loadDetail(showLoading = true) {
    if (!this.data.orderId) return
    if (showLoading) this.setData({ loading: true })
    try {
      const order = await request({ url: `/order/detail/${this.data.orderId}` })
      this.setOrder(order)
    } catch (e) {
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  setOrder(order) {
    const statusText = order.statusText || statusTextMap[order.status] || order.status
    const isPendingPayment = order.status === 'PENDING_PAYMENT'
    this.setData({
      order: {
        ...order,
        statusText,
        isPendingPayment
      },
      activeStep: statusIndexMap[order.status] ?? 0
    })
    if (isPendingPayment) {
      this.startCountdown(order.createTime)
    } else {
      this.clearTimer()
      this.setData({ expired: order.status === 'CANCELLED' })
    }
  },

  startCountdown(createTime) {
    this.clearTimer()
    const createAt = new Date(String(createTime).replace(' ', 'T')).getTime()
    const expireAt = createAt + PAY_LIMIT_SECONDS * 1000

    const tick = () => {
      const remainSeconds = Math.floor((expireAt - Date.now()) / 1000)
      if (remainSeconds <= 0) {
        this.setData({
          remainText: '00:00',
          expired: true
        })
        this.clearTimer()
        this.loadDetail(false)
        return
      }
      this.setData({
        remainText: formatRemain(remainSeconds),
        expired: false
      })
    }

    tick()
    this.timer = setInterval(tick, 1000)
  },

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  connectSocket() {
    this.setData({ socketStatus: '实时状态连接中' })
    socket.connectOrderSocket(this.data.orderId, {
      open: () => {
        this.setData({ socketStatus: '实时状态已开启' })
      },
      message: (message) => {
        if (!message || message.type !== 'ORDER_STATUS_CHANGE') return
        this.loadDetail(false)
      },
      error: () => {
        this.setData({ socketStatus: '实时连接异常，可手动刷新' })
      },
      close: () => {
        this.setData({ socketStatus: '实时连接断开，正在重连' })
      }
    })
  },

  refreshOrder() {
    this.loadDetail(true)
  },

  onPullDownRefresh() {
    this.loadDetail(true)
  },

  cancelOrder() {
    if (this.data.cancelling) return
    wx.showModal({
      title: '取消订单',
      content: '确定取消当前待支付订单吗？',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ cancelling: true })
        try {
          await request({
            url: `/order/${this.data.orderId}/cancel`,
            method: 'PUT'
          })
          wx.showToast({ title: '订单已取消', icon: 'success' })
          this.loadDetail(false)
        } finally {
          this.setData({ cancelling: false })
        }
      }
    })
  },

  backToPayment() {
    if (this.data.fromPayment) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: `/pages/payment/payment?orderId=${this.data.orderId}` })
  },

  goHistory() {
    wx.redirectTo({ url: '/pages/order-history/order-history' })
  },

  goMenu() {
    const order = this.data.order || {}
    wx.redirectTo({
      url: `/pages/menu/menu?storeId=${order.storeId || 1}&tableId=${order.tableId || 1}`
    })
  }
})
