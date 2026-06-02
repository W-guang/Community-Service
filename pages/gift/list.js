Page({
  data: {
    categories: ['全部', '优惠券', '生活用品', '粮油食品', '日用百货'],
    activeCategory: '全部',
    loading: false,
    items: [
      { name: '5元物业费抵扣券', points: 55, price: '5.00', img: '/zhekou.jpg', cat: '优惠券', tag: '热门' },
      { name: '蒸汽眼罩', points: 200, price: '25.00', img: '/yanzhao.jpg', cat: '生活用品', tag: '' },
      { name: '5L 花生油', points: 700, price: '106.00', img: '/you.jpg', cat: '粮油食品', tag: '新品' },
      { name: '抽纸套装', points: 80, price: '12.00', img: '/zhi.jpg', cat: '日用百货', tag: '' },
      { name: '大米 5kg', points: 350, price: '45.00', img: '', cat: '粮油食品', tag: '' },
      { name: '洗衣液 3kg', points: 120, price: '19.90', img: '', cat: '日用百货', tag: '' },
      { name: '口罩 50只', points: 40, price: '8.00', img: '', cat: '生活用品', tag: '' },
    ]
  },
  filteredItems() {
    const cat = this.data.activeCategory
    const items = cat === '全部' ? this.data.items : this.data.items.filter(i => i.cat === cat)
    this.setData({ filtered: items })
  },
  onShow() {
    this.filteredItems()
  },
  onTab(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ activeCategory: cat })
    this.filteredItems()
  }
})
