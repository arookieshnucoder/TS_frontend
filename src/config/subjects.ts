/** 前端可切换的三种学科标识，用于主题、草稿和演示会话隔离。 */
export type Subject = 'chinese' | 'math' | 'english'
export const subjectOrder: Subject[] = ['chinese', 'math', 'english']

/** 各学科的界面文案与示例题卡集中维护；这里只定义展示，不决定后端解题策略。 */
export const subjects = {
  chinese: {
    label: '语文', name: '知墨', english: 'ZHI MO', discipline: '语文研习室', icon: 'brush',
    eyebrow: '读懂字里行间，也写下你的万千',
    title: '一字一句，', titleAccent: '皆有回响。',
    description: '从一首诗的月色，到一篇文章的深意。',
    subdescription: '陪你细读、思考，让表达自然生长。',
    placeholder: '写下你的问题，让思绪落在纸上…',
    mode: '语文 · 阅读与表达', motto: '落笔有意，读书有光', exploration: '拾字成光',
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
    mode: '数学 · 思路与推演', motto: '循序而思，因理而明', exploration: '循理而行',
    sideNote: '保持好奇，答案自有来路。',
    emptyNote: '还没有对话。从一个好奇的问题开始。',
    suggestions: [
      { icon: 'function', title: '解一个方程', subtitle: '从未知出发，推导每一步的依据', text: '解方程 x² - 5x + 6 = 0，并检验答案。请逐步讲解思路。', tag: '代数方程' },
      { icon: 'chart', title: '探索函数', subtitle: '把抽象的关系，变成可见的规律', text: '求 y = x² - 4x + 1 的顶点坐标与对称轴，并解释配方法的思路。', tag: '函数图像' },
      { icon: 'triangle', title: '推演几何', subtitle: '在点、线、面之间，寻找关联', text: '直角三角形两边长分别是3和4，求第三边的所有可能值，并解释为什么需要分类讨论。', tag: '几何证明' },
      { icon: 'dice', title: '理解概率', subtitle: '从不确定中，找到确定的逻辑', text: '袋中有2个红球和1个白球，不放回摸2次，两次都是红球的概率是多少？', tag: '概率统计' },
    ],
  },
  english: {
    label: '英语', name: '言境', english: 'LEXICON', discipline: '英语研习室', icon: 'language',
    eyebrow: 'A little context. A world of meaning.',
    title: '读懂语境，', titleAccent: '让世界更近。',
    description: '从一个词的细微差别，到一段文字的完整含义。',
    subdescription: '沿着线索阅读，在语境里理解每一个选择。',
    placeholder: '贴上阅读短文、题目与选项，一起读懂语境…',
    mode: '英语 · 阅读与选择', motto: 'Read between the lines.', exploration: 'Words into worlds',
    sideNote: 'Words open worlds. 让理解发生。',
    emptyNote: '还没有对话。从一句英文，一段阅读开始。',
    suggestions: [
      { icon: 'reading', title: '读懂一段', subtitle: 'Reading · 沿线索，找到原文依据', text: '[英语]\n阅读下面短文并回答选择题，给出答案和原文依据。\n[Passage]\nEvery Saturday, Emma takes a bus to the city library. She reads science books there for two hours. Before going home, she borrows a novel for her little brother.\n[Questions]\n1. Why does Emma borrow a novel?\nA. To prepare for a test.\nB. To read on the bus.\nC. To give it to her little brother.\nD. To return it to school.', tag: '阅读理解' },
      { icon: 'grammar', title: '理清语法', subtitle: 'Grammar · 让时间线说清时态', text: '[英语]\n请完成下面的语法选择题，并解释时态依据。\n1. By the time we arrived at the station, the train ____.\nA. leaves\nB. has left\nC. had left\nD. will leave', tag: '语法选择' },
      { icon: 'link', title: '补全逻辑', subtitle: 'Cloze · 从转折中读出句间关系', text: '[英语]\n请完成下面的完形填空选择题，说明句间逻辑并排除干扰项。\n[Passage]\nThe hike was tiring. ____, Maya kept walking because she wanted to see the sunrise.\n[Questions]\n1. Which word best completes the blank in the passage?\nA. However\nB. Therefore\nC. For example\nD. Similarly', tag: '完形填空' },
      { icon: 'vocabulary', title: '读懂一个词', subtitle: 'Vocabulary · 在上下文里寻找词义', text: '[英语]\n阅读下面句子，选择 reluctant 的语境含义，并说明判断依据。\n[Passage]\nLeo was reluctant to speak in front of the class. He looked down and asked if he could go last.\n[Questions]\n1. What does "reluctant" most nearly mean?\nA. Excited and eager\nB. Unwilling or hesitant\nC. Loud and confident\nD. Fully prepared', tag: '语境词义' },
    ],
  },
} as const
