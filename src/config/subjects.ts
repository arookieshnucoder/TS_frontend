export type Subject = 'chinese' | 'math'

export const subjects = {
  chinese: {
    label: '语文', name: '知墨', english: 'ZHI MO', discipline: '语文研习室', icon: 'brush',
    eyebrow: '读懂字里行间，也写下你的万千',
    title: '一字一句，', titleAccent: '皆有回响。',
    description: '从一首诗的月色，到一篇文章的深意。',
    subdescription: '陪你细读、思考，让表达自然生长。',
    placeholder: '写下你的问题，让思绪落在纸上…',
    mode: '语文 · 阅读与表达', motto: '落笔有意，读书有光',
    sideNote: '一间书斋，一方天地。',
    emptyNote: '还没有对话。从一首诗、一段文字开始。',
    suggestions: [
      { icon: 'book', title: '读一首诗', subtitle: '在诗词里，遇见另一种风景', text: '请带我赏析苏轼的《定风波·莫听穿林打叶声》，理解它的意境与情感。', tag: '诗词鉴赏' },
      { icon: 'feather', title: '写一段话', subtitle: '把平常的日子，写得有声有色', text: '我想写一篇关于“雨后校园”的作文，请帮我梳理观察角度与写作思路。', tag: '写作灵感' },
      { icon: 'scroll', title: '解一篇古文', subtitle: '越过千年，让古人的话更近一些', text: '请讲解《陋室铭》的主旨、重点字词和“谈笑有鸿儒，往来无白丁”的含义。', tag: '文言研读' },
      { icon: 'chat', title: '品一段文字', subtitle: '从修辞与细节中，读出言外之意', text: '“盼望着，盼望着，东风来了，春天的脚步近了。”这句话用了哪些修辞，有什么表达效果？', tag: '阅读理解' },
    ],
  },
  math: {
    label: '数学', name: '序理', english: 'XU LI', discipline: '数学探索室', icon: 'orbit',
    eyebrow: '每一个问题，都有通向理解的路径',
    title: '让每一步，', titleAccent: '都有道理。',
    description: '从一个未知数，到一个豁然开朗的瞬间。',
    subdescription: '陪你拆解、推演，发现数学的清晰与美。',
    placeholder: '输入题目、公式与条件，一起找到解题的路径…',
    mode: '数学 · 思路与推演', motto: '循序而思，因理而明',
    sideNote: '保持好奇，答案自有来路。',
    emptyNote: '还没有对话。从一个好奇的问题开始。',
    suggestions: [
      { icon: 'function', title: '解一个方程', subtitle: '从未知出发，推导每一步的依据', text: '解方程 x² - 5x + 6 = 0，并检验答案。请逐步讲解思路。', tag: '代数方程' },
      { icon: 'chart', title: '探索函数', subtitle: '把抽象的关系，变成可见的规律', text: '求 y = x² - 4x + 1 的顶点坐标与对称轴，并解释配方法的思路。', tag: '函数图像' },
      { icon: 'triangle', title: '推演几何', subtitle: '在点、线、面之间，寻找关联', text: '直角三角形两边长分别是3和4，求第三边的所有可能值，并解释为什么需要分类讨论。', tag: '几何证明' },
      { icon: 'dice', title: '理解概率', subtitle: '从不确定中，找到确定的逻辑', text: '袋中有2个红球和1个白球，不放回摸2次，两次都是红球的概率是多少？', tag: '概率统计' },
    ],
  },
} as const
