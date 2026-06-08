const { request } = require('../../utils/request')
const cartUtil = require('../../utils/cart')

const PAY_LIMIT_SECONDS = 15 * 60

function formatRemain(seconds) {
  const safe = Math.max(seconds, 0)
  const min = String(Math.floor(safe / 60)).padStart(2, '0')
  const sec = String(safe % 60).padStart(2, '0')
  return `${min}:${sec}`
}

Page({
  data: {
    orderId: null,
    order: null,
    remainSeconds: PAY_LIMIT_SECONDS,
    remainText: formatRemain(PAY_LIMIT_SECONDS),
    paymentStatus: '待支付',
    expired: false,
    paying: false,
    autoCancelling: false
  },

  onLoad(options) {
    this.setData({ orderId: Number(options.orderId) })
    this.loadOrder()
  },

  onUnload() {
    this.clearTimer()
  },

  async loadOrder() {
    try {
      const order = await request({ url: `/order/detail/${this.data.orderId}` })
      this.setData({ order })
      this.updatePaymentStatus(order)
      if (order.status === 'PENDING_PAYMENT') {
        this.startCountdown(order.createTime)
      }
    } catch (e) {
      wx.showToast({ title: '订单加载失败', icon: 'none' })
    }
  },

  updatePaymentStatus(order) {
    if (order.status === 'CANCELLED') {
      this.setData({ paymentStatus: '订单已取消', expired: true })
      this.clearTimer()
      return
    }
    if (order.payStatus === 'PAID' || order.status !== 'PENDING_PAYMENT') {
      this.setData({ paymentStatus: '支付成功', expired: false })
      this.clearTimer()
      return
    }
    this.setData({ paymentStatus: '待支付' })
  },

  startCountdown(createTime) {
    this.clearTimer()
    const createAt = new Date(String(createTime).replace(' ', 'T')).getTime()
    const expireAt = createAt + PAY_LIMIT_SECONDS * 1000

    const tick = () => {
      const remainSeconds = Math.floor((expireAt - Date.now()) / 1000)
      if (remainSeconds <= 0) {
        this.setData({
          remainSeconds: 0,
          remainText: '00:00',
          expired: true,
          paymentStatus: '支付超时，正在取消订单'
        })
        this.clearTimer()
        this.autoCancelOrder()
        return
      }
      this.setData({
        remainSeconds,
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

  async autoCancelOrder() {
    if (this.data.autoCancelling || !this.data.order || this.data.order.status !== 'PENDING_PAYMENT') return
    this.setData({ autoCancelling: true })
    try {
      await request({
        url: `/order/${this.data.orderId}/cancel`,
        method: 'PUT'
      })
      this.setData({ paymentStatus: '支付超时，订单已自动取消' })
      wx.showToast({ title: '订单已自动取消', icon: 'none' })
      wx.redirectTo({ url: `/pages/order-detail/order-detail?orderId=${this.data.orderId}` })
    } catch (e) {
      this.setData({ paymentStatus: '支付超时，请刷新订单详情' })
    } finally {
      this.setData({ autoCancelling: false })
    }
  },

  payOrder() {
    if (this.data.expired) {
      wx.showToast({ title: '支付已超时', icon: 'none' })
      return
    }
    if (this.data.paying) return

    wx.showModal({
      title: '确认支付',
      content: `确认支付 ¥${this.data.order.totalAmount} 吗？`,
      confirmText: '确认支付',
      cancelText: '暂不支付',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ paymentStatus: '待支付' })
          return
        }
        await this.submitPayment()
      }
    })
  },

  async submitPayment() {
    this.setData({ paying: true, paymentStatus: '支付中' })
    try {
      await request({
        url: `/order/${this.data.orderId}/pay`,
        method: 'POST'
      })
      if (this.data.order && this.data.order.tableId) {
        cartUtil.clearCart(this.data.order.tableId)
        cartUtil.clearCheckoutCart(this.data.orderId, this.data.order.tableId)
      }
      this.setData({ paymentStatus: '支付成功' })
      wx.showToast({ title: '支付成功', icon: 'success' })
      wx.redirectTo({ url: `/pages/order-detail/order-detail?orderId=${this.data.orderId}` })
    } catch (e) {
      this.setData({ paymentStatus: this.data.expired ? '支付已超时' : '支付失败' })
      wx.redirectTo({ url: `/pages/order-detail/order-detail?orderId=${this.data.orderId}` })
    } finally {
      this.setData({ paying: false })
    }
  },

  goOrderDetail() {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${this.data.orderId}&from=payment` })
  }
})
