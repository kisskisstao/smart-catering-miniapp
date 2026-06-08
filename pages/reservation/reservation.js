const { request } = require('../../utils/request')
const { connectTableStatusSocket, closeSocket } = require('../../utils/socket')

const statusText = {
  FREE: '空闲',
  RESERVED: '已预订',
  OCCUPIED: '就餐中',
  DIRTY: '待清理',
  AVAILABLE: '空闲',
  USING: '就餐中',
  CLEANING: '待清理'
}

function today() {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

Page({
  data: {
    storeId: 1,
    tables: [],
    selectedTableId: null,
    reservationDate: today(),
    reservationTime: '18:00',
    partySize: 2,
    contactName: '',
    contactPhone: '',
    remark: '',
    loading: false,
    submitting: false
  },

  onLoad(options) {
    const storeId = Number(options.storeId || wx.getStorageSync('storeId') || 1)
    this.setData({ storeId })
    this.loadTables()
  },

  onShow() {
    this.connectStatusSocket()
  },

  onHide() {
    closeSocket()
  },

  onUnload() {
    closeSocket()
  },

  async loadTables() {
    this.setData({ loading: true })
    try {
      const tables = await request({
        url: '/table/list',
        data: { storeId: this.data.storeId }
      })
      this.setData({ tables: this.decorateTables(tables || []) })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  connectStatusSocket() {
    connectTableStatusSocket(this.data.storeId, {
      message: (message) => {
        if (!message || message.type !== 'TABLE_STATUS_CHANGED') return
        if (Number(message.storeId) !== Number(this.data.storeId)) return
        this.applyTableStatus(message)
      }
    })
  },

  applyTableStatus(message) {
    const tableId = Number(message.tableId)
    const tables = this.data.tables.map(item => {
      if (Number(item.id) !== tableId) return item
      return this.decorateTable({
        ...item,
        status: message.status,
        seats: message.seats,
        tableNo: message.tableNo || item.tableNo
      })
    })
    const selectedTable = tables.find(item => Number(item.id) === Number(this.data.selectedTableId))
    this.setData({
      tables,
      selectedTableId: selectedTable && selectedTable.status === 'FREE' ? selectedTable.id : null
    })
  },

  decorateTables(tables) {
    return tables.map(item => this.decorateTable(item))
  },

  decorateTable(table) {
    const status = this.normalizeStatus(table.status || 'FREE')
    return {
      ...table,
      status,
      statusLabel: statusText[status] || status,
      available: status === 'FREE'
    }
  },

  normalizeStatus(status) {
    const upper = String(status || 'FREE').toUpperCase()
    if (upper === 'AVAILABLE') return 'FREE'
    if (upper === 'USING') return 'OCCUPIED'
    if (upper === 'CLEANING') return 'DIRTY'
    return upper
  },

  selectTable(e) {
    const tableId = Number(e.currentTarget.dataset.id)
    const table = this.data.tables.find(item => Number(item.id) === tableId)
    if (!table || !table.available) {
      wx.showToast({ title: '只能选择空闲桌台', icon: 'none' })
      return
    }
    this.setData({ selectedTableId: tableId })
  },

  onDateChange(e) {
    this.setData({ reservationDate: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ reservationTime: e.detail.value })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  changePartySize(e) {
    const delta = Number(e.currentTarget.dataset.delta)
    const next = Math.max(1, Number(this.data.partySize || 1) + delta)
    this.setData({ partySize: next })
  },

  async submitReservation() {
    if (this.data.submitting) return
    if (!this.data.selectedTableId) {
      wx.showToast({ title: '请选择空闲桌台', icon: 'none' })
      return
    }
    if (!this.data.contactName.trim() || !this.data.contactPhone.trim()) {
      wx.showToast({ title: '请填写联系人和电话', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      await request({
        url: '/reservation/create',
        method: 'POST',
        data: {
          storeId: this.data.storeId,
          tableId: this.data.selectedTableId,
          contactName: this.data.contactName.trim(),
          contactPhone: this.data.contactPhone.trim(),
          reservationDate: this.data.reservationDate,
          reservationTime: this.data.reservationTime,
          partySize: Number(this.data.partySize),
          remark: this.data.remark.trim()
        }
      })
      wx.showToast({ title: '预约已提交', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/reservation-list/reservation-list' })
      }, 700)
    } finally {
      this.setData({ submitting: false })
    }
  },

  onPullDownRefresh() {
    this.loadTables()
  }
})
