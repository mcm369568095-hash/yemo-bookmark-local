#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
夜秣浏览器书签本地整理 · 生成引擎
------------------------------------------------
把 Chrome / Edge / Firefox / Safari 导出的书签 HTML，变成一张
可搜索、可筛选、可换皮肤、卡片式的本地导航页。全程不联网、不上传。

用法：
    python generate.py <书签文件.html> [-o 输出.html] [--skin 皮肤ID]
                       [--name "夜秣的书签"] [--mark 秣] [--mark-color #e94b8a]
                       [--icons auto|inline|direct|favicon-im|google|none]
                       [--desc 补充说明.json] [--gh github数据.json]

名字和图标都从 --name 推出来，不给就交互式问一遍；
不写死任何人名，别人拿到这套技能填自己的名字就能用。

作者：夜秣原创
"""

import argparse
import html as html_mod
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")

# ──────────────────────────────────────────────────────────
# 站点简介库：常见站点给一句人话，没有的就回落成收藏来源
# ──────────────────────────────────────────────────────────
KNOWN_SITES = {
    "chat.deepseek.com": "DeepSeek 深度求索，国产大模型对话",
    "chatgpt.com": "OpenAI ChatGPT 对话助手",
    "gemini.google.com": "Google Gemini 多模态 AI",
    "claude.ai": "Anthropic Claude 长文本对话",
    "kimi.moonshot.cn": "月之暗面 Kimi，长文档阅读",
    "tongyi.aliyun.com": "阿里通义千问",
    "yuanbao.tencent.com": "腾讯元宝，混元大模型",
    "doubao.com": "字节豆包 AI 助手",
    "poe.com": "Poe 多模型聚合对话",
    "huggingface.co": "HuggingFace 模型与数据集社区",
    "civitai.com": "Civitai 图像模型分享站",
    "comfyui.org": "ComfyUI 节点式绘图工作流",
    "mp.weixin.qq.com": "微信公众号后台 / 文章编辑",
    "developers.weixin.qq.com": "微信开发者文档",
    "open.weixin.qq.com": "微信开放平台",
    "work.weixin.qq.com": "企业微信管理后台",
    "docs.qq.com": "腾讯文档在线协作",
    "cloud.tencent.com": "腾讯云控制台",
    "dash.cloudflare.com": "Cloudflare 控制面板",
    "github.com": "GitHub 代码托管",
    "gitee.com": "Gitee 码云",
    "youtube.com": "YouTube 视频平台",
    "bilibili.com": "哔哩哔哩",
    "zhihu.com": "知乎",
    "xiaohongshu.com": "小红书",
    "weibo.com": "微博",
    "douyin.com": "抖音",
    "notion.so": "Notion 笔记与协作",
    "obsidian.md": "Obsidian 本地知识库",
    "feishu.cn": "飞书",
    "dingtalk.com": "钉钉",
    "yuque.com": "语雀文档",
    "vercel.com": "Vercel 前端部署",
    "netlify.com": "Netlify 静态托管",
    "twitter.com": "X / Twitter",
    "x.com": "X / Twitter",
    "t.me": "Telegram",
    "pan.baidu.com": "百度网盘",
    "pan.quark.cn": "夸克网盘",
    "aliyundrive.com": "阿里云盘",
    "translate.google.com": "Google 翻译",
    "deepl.com": "DeepL 翻译",
    "canva.com": "Canva 在线设计",
    "figma.com": "Figma 界面设计",
    "excalidraw.com": "Excalidraw 手绘白板",
    "ilovepdf.com": "iLovePDF 在线 PDF 工具",
    "remove.bg": "remove.bg 一键抠图",
    "tinypng.com": "TinyPNG 图片压缩",
    "stackoverflow.com": "Stack Overflow 技术问答",
    "npmjs.com": "npm 包仓库",
    "pypi.org": "PyPI Python 包索引",
}

# ──────────────────────────────────────────────────────────
# 分类规则：每条 = (分类名, 域名特征, 标题特征)
# 命中域名算 3 分，命中标题算 1 分，取最高分；平局看谁写在前面。
# 域名用「包含」匹配，长的优先，所以 a.b.com 能压过 b.com 的泛规则。
# ──────────────────────────────────────────────────────────
CATS = [
    ("GitHub / 开源", [
        "github.com", "github.io", "gitcode.com", "atomgit", "gitee.com",
        "gitlab", "bitbucket", "huggingface.co", "npmjs.com", "pypi.org",
        "eden-emu.dev", "raw.githubusercontent",
    ], ["开源", "github", "仓库", "repo", "源码"]),

    ("AI 检测 / 降重", [
        "matrix.tencent.com", "aifoxs.com", "xiaofamao.com", "bypassgpt.co",
        "wzgty.com", "gptzero", "zerogpt", "originality.ai", "sapling.ai",
        "quillbot.com", "ai-detect", "aicheat",
    ], ["ai检测", "降ai", "降aigc", "降重", "伪原创", "去ai味", "去味", "aigc检测",
        "朱雀", "humaniz", "绕过检测", "检测率", "ai率", "原创度", "洗稿"]),

    ("AI 对话 / 助手", [
        "chat.deepseek.com", "deepseek.com", "chatgpt.com", "chat.openai.com",
        "openai.com", "gemini.google.com", "notebooklm.google.com", "claude.ai",
        "kimi.moonshot", "moonshot.cn", "tongyi.aliyun", "yuanbao.tencent",
        "doubao.com", "poe.com", "grok.com", "chatglm", "bigmodel.cn",
        "wujieai.com", "manus.im", "aistudio.google.com", "xiaomimimo",
        "creao.ai", "openclaw101", "perplexity.ai", "copilot.microsoft",
        "xiaofamao.com/result", "allyhub.com", "yikeai.com", "tianfu-ai.com",
        "youmind.com", "open.workbuddy.cn",
        "tianfuagent.com", "chat.qwen", "qwen.ai",
    ], ["对话", "chat", "助手", "gpt", "deepseek", "gemini", "claude", "豆包",
        "元宝", "kimi", "通义", "智谱", "agent"]),

    ("AI 绘画 / 提示词", [
        "image2.fun", "mikuapi.org", "aishort.top", "topai.ink", "aiwind.org",
        "meigen.ai", "spaceprompts", "promptimage.org", "novelai.net",
        "raphael.app", "midjourney", "civitai.com", "runninghub.cn", "comfyui",
        "liblib.art", "yituohub.com", "prompt.always200", "aiistudio.com",
        "ai.mikuapi", "hiddify", "krea.ai", "seaart.ai", "tensor.art",
    ], ["提示词", "prompt", "绘画", "生图", "绘图", "文生图", "出图", "画师",
        "midjourney", "comfyui", "stable diffusion", "工作流"]),

    ("AI 中转 / API", [
        "qiuqiutoken.com", "catrouter.net", "memefast.top", "4sapi.com",
        "redfox.hk", "xcrawl.com", "build.nvidia.com", "openrouter.ai",
        "oneapi", "newapi", "api.", "gpt.qt.cool", "kaisir", "aihubmix",
        "closeai", "api2d", "openai-sb",
    ], ["中转", "令牌", "token", "额度", "接口", "计费", "apikey", "密钥", "api"]),

    ("公众号 / 自媒体", [
        "mp.weixin.qq.com", "editor.mdnice.com", "xmyeditor.com", "snapwrite",
        "down.mptext.top", "newrank.cn", "dajiala.com", "wxrank.com",
        "jzl.com", "developers.weixin.qq.com", "open.weixin.qq.com",
        "aitoearn.ai", "mind2post.com", "xiaohongshu.com", "ec.xiaohongshu",
        "toutiao.com", "zhihu.com", "weibo.com", "douyin.com", "bilibili.com",
        "instagram.com", "t.me", "x.com", "twitter.com", "t.co",
    ], ["公众号", "排版", "编辑器", "微信", "自媒体", "小红书", "流量主",
        "文章导出", "新媒体", "图文"]),

    ("代理 / 网络工具", [
        "benfuip.com", "xpptp.com", "ipaaaa.com", "ip0168.com", "canghaiip.com",
        "tangguoip.com", "tianqiip.com", "ipjiance.com", "socks5ip.com.cn",
        "ldy38.com", "cobalt.tools", "537393.xyz", "de5.net", "claw123.com",
        "hiddify.com", "v2ray", "clash", "surge", "warp", "ahhhhfs.com",
        "dmhy", "south-plus", "btsow",
    ], ["代理", "加速器", "vpn", "sk5", "socks5", "单窗口", "节点", "机场",
        "翻墙", "隧道", "免流"]),

    ("云服务 / 部署", [
        "aliyun.com", "cloud.tencent.com", "console.volcengine.com", "ctyun.cn",
        "scnet.cn", "dash.cloudflare.com", "workers.dev", "cloudns.net",
        "digitalplat", "vercel.com", "netlify.com", "mongodb.com",
        "npmmirror.com", "pages.dev", "cloudflare.com", "aws.amazon",
        "azure.com", "rainyun", "siliconflow", "autodl.com", "octop.cloud",
        "developer.huawei.com", "huaweicloud", "aliyun.",
    ], ["云服务器", "云主机", "控制台", "部署", "轻量应用", "域名", "证书",
        "对象存储", "cdn", "ecs", "主机"]),

    ("网盘 / 资源搜索", [
        "pan.club", "pioz.cn", "upyunso.com", "melost.cn", "252035.xyz",
        "link3.cc", "pan.baidu.com", "pan.quark.cn", "aliyundrive.com",
        "kaoyany.top", "youxuan68.com", "quark.cn", "drive.google",
        "1drv.ms", "lanzou", "aliyundrive", "fmhy.net",
    ], ["网盘", "夸克", "资源库", "盘搜", "藏宝阁", "资源下载", "合集",
        "课程下载", "迅雷"]),

    ("教程 / 博客 / 论坛", [
        "blog.csdn.net", "learn.microsoft.com", "52pojie.cn", "jb51.net",
        "2265.com", "xszn.org", "open.nlc.cn", "youtube.com", "vimeo.com",
        "zhuanlan.zhihu", "jianshu.com", "cnblogs.com", "segmentfault",
        "stackoverflow.com", "flowus.cn", "w3school", "runoob.com",
    ], ["教程", "博客", "公开课", "课程", "攻略", "文档", "手册", "笔记",
        "入门", "指南", "安装"]),

    ("影视 / 游戏", [
        "3dmgame.com", "oldgames.space", "549.tv", "blizzard.cn",
        "battlenet.com.cn", "steam", "epicgames", "nintendo", "playstation",
        "douban.com", "iqiyi.com", "youku.com", "mgtv.com", "tencentvideo",
        "fanqienovel.com", "shortdramas.com", "hongxiu", "qidian.com",
    ], ["游戏", "影视", "电影", "观看", "在线看", "模拟器", "主机", "steam"]),

    ("设计 / 素材", [
        "unsplash.com", "uugai.com", "gaoding.com", "canva.com", "figma.com",
        "iconfont.cn", "pexels.com", "dribbble.com", "behance.net",
        "tinypng.com", "remove.bg", "excalidraw.com", "photopea",
    ], ["logo", "设计", "素材", "图片", "抠图", "压缩", "图标", "字体",
        "配色", "海报"]),

    ("效率 / 文档", [
        "feishu.cn", "notion.so", "obsidian.md", "flowus.cn", "yuque.com",
        "docs.qq.com", "localhost", "n8n.io", "coze.cn", "skillhub.cn",
        "dingtalk.com", "wps.cn", "kdocs.cn", "processon.com", "zhiyun",
        "nicetool.net", "anjian.com", "visualget.com", "88cha.com",
        "tophub.today", "defuddle.md", "tab.ipadxia.com", "chaoyunying.com",
    ], ["文档", "笔记", "工作流", "看板", "表格", "协作", "待办", "白板",
        "知识库", "多维表"]),

    ("购物 / 生活", [
        "taobao.com", "tmall.com", "jd.com", "pinduoduo", "1688.com",
        "meituan.com", "dianping.com", "amazon.",
    ], ["购物", "淘宝", "京东", "商城", "商品", "下单"]),
]

# 这些「根文件夹」不算真实分类，落到它们时改用关键词判断
ROOT_FOLDERS = {
    "书签栏", "书签工具栏", "其他书签", "未分类", "收藏夹", "收藏夹栏",
    "bookmarks bar", "bookmarks toolbar", "bookmarks", "other bookmarks",
    "favorites bar", "favorites", "书签", "根目录",
    "已导入", "导入的", "imported", "imported bookmarks", "移动设备书签",
}

SKIP_URL = re.compile(r"^(javascript:|place:|data:|about:|chrome:|edge:|file:)", re.I)


# ──────────────────────────────────────────────────────────
# 书签解析：按 Chrome 的 <DT><H3>文件夹</H3><DL> 嵌套结构走
# ──────────────────────────────────────────────────────────
class BookmarkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # 当前文件夹路径
        self.pending_folder = None
        self.in_h3 = False
        self.h3_buf = ""
        self.cur_a = None
        self.items = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "h3":
            self.in_h3 = True
            self.h3_buf = ""
        elif tag == "dl":
            name = (self.pending_folder or "").strip()
            self.stack.append(name)
            self.pending_folder = None
        elif tag == "a":
            d = dict(attrs)
            href = (d.get("href") or "").strip()
            self.cur_a = {
                "href": href,
                "icon": (d.get("icon") or d.get("icon_uri") or "").strip(),
                "text": "",
            }
            self.pending_folder = None

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h3":
            self.in_h3 = False
            self.pending_folder = self.h3_buf
        elif tag == "dl":
            if self.stack:
                self.stack.pop()
        elif tag == "a" and self.cur_a is not None:
            href = self.cur_a["href"]
            title = re.sub(r"\s+", " ", self.cur_a["text"]).strip()
            if href and not SKIP_URL.match(href):
                folder = self._real_folder()
                self.items.append({
                    "url": href,
                    "title": title,
                    "folder": folder,
                    "icon": self.cur_a["icon"],
                })
            self.cur_a = None

    def handle_data(self, data):
        if self.in_h3:
            self.h3_buf += data
        elif self.cur_a is not None:
            self.cur_a["text"] += data

    def _real_folder(self):
        """取最近一个不是根目录的文件夹名作为分类依据"""
        for name in reversed(self.stack):
            n = (name or "").strip()
            if n and n.lower() not in ROOT_FOLDERS:
                return n
        return ""


# ──────────────────────────────────────────────────────────
# 分类判断
# ──────────────────────────────────────────────────────────
def _dom_hit(pat, host, url):
    """域名特征匹配：带点的按 host 边界比，避免 linux.com 误命中 x.com"""
    if "/" in pat:
        return pat in url
    if pat.endswith("."):
        return host.startswith(pat) or ("." + pat) in host
    if "." in pat:
        return host == pat or host.endswith("." + pat)
    return pat in host


def classify(item):
    """文件夹优先；没文件夹就用「域名 3 分 + 标题 1 分」打分，最高者胜。

    域名特征按长度降序比，保证 cloud.tencent.com 不会被 tencent 这种泛规则抢走。
    """
    folder = item.get("folder", "")
    if folder:
        return clamp_cat(folder)

    url = item["url"].lower()
    host = domain_of(item["url"])
    title = (item["title"] or "").lower()
    best, best_score = "其他", 0

    for idx, (cat, doms, kws) in enumerate(CATS):
        score = 0
        for d in doms:
            if _dom_hit(d, host, url):
                # 域名越长越精确，给 3~5 分
                score += 5 if len(d) >= 14 else 3
                break
        for k in kws:
            if k in title:
                score += 1
        if score > best_score:
            best, best_score = cat, score

    return best


def clamp_cat(name):
    """文件夹名太长就截断，太长会在胶囊上换行"""
    name = re.sub(r"\s+", " ", name).strip()
    if len(name) > 12:
        name = name[:12]
    return name or "其他"


def domain_of(url):
    try:
        h = urlparse(url).hostname or ""
        h = h.lower()
        return h[4:] if h.startswith("www.") else h
    except Exception:
        return ""


def lookup_desc(domain, item, extra):
    """简介优先级：补充库 > 已知站点 > GitHub 数据 > 收藏来源"""
    d = domain
    if d in extra:
        return extra[d]
    # 逐级剥子域：a.b.example.com -> b.example.com -> example.com
    parts = d.split(".")
    for i in range(1, len(parts) - 1):
        sub = ".".join(parts[i:])
        if sub in extra:
            return extra[sub]
        if sub in KNOWN_SITES:
            return KNOWN_SITES[sub]
    if d in KNOWN_SITES:
        return KNOWN_SITES[d]
    if item.get("gh_desc"):
        return item["gh_desc"]
    folder = item.get("folder")
    if folder:
        return "收藏于「%s」" % folder
    return ""


def icon_url(url, mode):
    d = domain_of(url)
    if not d:
        return ""
    if mode == "none":
        return ""
    if mode == "favicon-im":
        return "https://favicon.im/%s?larger=true" % d
    if mode == "google":
        return "https://www.google.com/s2/favicons?domain=%s&sz=64" % d
    return "https://%s/favicon.ico" % d


def pick_icon(item, mode):
    """图标来源。

    inline  = 用书签文件里自带的 base64 图标（完全离线，不联网）
    auto    = 有内嵌图标就用内嵌，没有再退回联网抓 favicon（默认）
    direct  = 站点根目录 favicon.ico（需联网）
    """
    if mode == "none":
        return ""
    builtin = item.get("icon") or ""
    has_builtin = builtin.startswith("data:image")
    if mode == "inline":
        return builtin if has_builtin else ""
    if mode == "auto":
        return builtin if has_builtin else icon_url(item["url"], "direct")
    return icon_url(item["url"], mode)


GH_PATH = re.compile(r"github\.com/([^/?#]+)/([^/?#]+)", re.I)
GH_RESERVED = {"topics", "search", "collections", "sponsors", "marketplace",
               "orgs", "settings", "features", "explore", "trending"}


def refine_item(it):
    """GitHub 书签在浏览器里的标题常是「owner/repo: 描述」，拆成更好读的名字+简介。

    返回 (显示名, 简介线索)。非 GitHub 原样返回。
    """
    name, hint = it["title"], ""
    m = GH_PATH.search(it["url"])
    if not m or m.group(1).lower() in GH_RESERVED:
        return name, hint

    owner, repo = m.group(1), m.group(2)
    head, sep, tail = name.partition(":")
    if "/" in head:
        short = head.split("/", 1)[-1].strip()
        if sep:
            name = short or repo
            hint = tail.strip()
        else:
            name = short or repo
    if not hint:
        hint = "%s/%s" % (owner, repo)
    # 浏览器标题末尾常挂 "· GitHub"，去掉更干净
    tail_pat = r"\s*[·\-–—]\s*GitHub\s*$"
    name = re.sub(tail_pat, "", name, flags=re.I).strip()
    hint = re.sub(tail_pat, "", hint, flags=re.I).strip()
    # "... at main · owner/repo" 这种尾巴也去掉，免得标题重复
    dup = r"\s*[·\-–—]\s*" + re.escape("%s/%s" % (owner, repo)) + r"\s*$"
    name = re.sub(dup, "", name, flags=re.I).strip()
    return name, hint


def dedupe(items):
    """按域名+路径去重，同址多个书签只留第一个"""
    seen = set()
    out = []
    for it in items:
        try:
            p = urlparse(it["url"])
            key = (p.netloc.lower() + p.path.rstrip("/")).lower()
        except Exception:
            key = it["url"]
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


# ──────────────────────────────────────────────────────────
# HTML 组装
# ──────────────────────────────────────────────────────────
TPL = r"""<!DOCTYPE html>
<html lang="zh-CN" data-theme="yemo-navy">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="夜秣浏览器书签本地整理">
<meta name="robots" content="noindex, nofollow">
<title>__TITLE__</title>
<style>
__CSS__
</style>
</head>
<body>
<div class="shell">

  <header class="topbar">
    <div class="topbar-row">
      <div class="brand">
        <div class="brand-mark" style="__MARK_STYLE__">__MARK__</div>
        <div class="brand-text">
          <div class="brand-title">__TITLE__</div>
          <div class="brand-sub">本地书签 · 共 __TOTAL__ 个站点</div>
        </div>
      </div>

      <div class="search-wrap" id="searchWrap">
        __ICON_SEARCH__
        <input id="q" type="search" placeholder="搜名称、简介、网址…   按 / 快速聚焦" autocomplete="off" spellcheck="false">
        <button class="search-clear" id="clearQ" aria-label="清空">×</button>
      </div>

      <div class="tool-group">
        <button class="icon-btn" id="viewToggle" aria-label="切换视图"></button>
        <button class="icon-btn square" id="darkToggle" aria-label="切换深浅色">
          <span id="darkToggleIcon"></span>
        </button>
        <button class="icon-btn" id="themeBtn">
          __ICON_PALETTE__<span>皮肤</span>
        </button>
      </div>

      <div class="stats">
        <div class="stat"><b id="statTotal">0</b><span>收录</span></div>
        <div class="stat"><b id="statCat">0</b><span>分类</span></div>
        <div class="stat"><b id="statShow">0</b><span>显示</span></div>
      </div>
    </div>
  </header>

  <div class="chips" id="chips"></div>

  <main id="list"></main>
  <div id="grid" class="grid"></div>

  <div class="empty" id="empty" style="display:none">
    <div class="big">🔍</div>
    <p>没找到匹配的书签，换个关键词试试。</p>
  </div>

  <footer class="foot">
    <span>夜秣原创 · 本地生成于 __GENERATED__</span>
    <span>数据不出本机 · 单文件可离线打开</span>
  </footer>
</div>

<div class="overlay" id="overlay">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="主题皮肤">
    <div class="dialog-head">
      <div>
        <h3>主题皮肤</h3>
        <p id="themeCurrent">换一套配色，偏好只存在你自己的浏览器里</p>
      </div>
      <div class="spacer"></div>
      <button class="icon-btn square" id="closeDialog" aria-label="关闭">×</button>
    </div>

    <div class="dialog-body">
      <div class="section-label">外观模式</div>
      <div class="mode-row">
        <button class="mode-btn" data-mode="light">
          __ICON_SUN__<span>浅色</span>
        </button>
        <button class="mode-btn" data-mode="dark">
          __ICON_MOON__<span>深色</span>
        </button>
        <button class="mode-btn" data-mode="auto">
          __ICON_AUTO__<span>跟随系统</span>
        </button>
      </div>

      <div class="section-label">配色方案</div>
      <div class="theme-grid" id="themeGrid"></div>

      <div class="custom-actions" style="margin-bottom:16px">
        <button class="btn-sm" id="rollbackBtn">← 回退上一套</button>
        <button class="btn-sm" id="resetBtn">恢复默认</button>
      </div>

      <div class="section-label">自定义 / 分享皮肤</div>
      <div class="custom-zone">
        <textarea id="themeJson" placeholder='粘贴主题 JSON，格式：{ "name": "我的皮肤", "light": { "background": "#fff", "foreground": "#222", "primary": "#2563eb" }, "dark": { ... } }'></textarea>
        <div class="custom-actions">
          <button class="btn-sm primary" id="importBtn">应用这套</button>
          <button class="btn-sm" id="exportBtn">导出当前皮肤</button>
        </div>
        <p class="hint">
          只需要给 <code>background / foreground / primary</code> 三个色就能成型，
          其余颜色会自动推导。导入时会做安全校验，非法值会被丢弃。
        </p>
      </div>
    </div>
  </div>
</div>

<button id="toTop" aria-label="回到顶部"></button>
<div class="toast" id="toast"></div>

<script>
window.BOOKMARKS = __DATA__;
window.BM_META = __META__;
</script>
<script>
__THEME_JS__
</script>
<script>
__APP_JS__
</script>
</body>
</html>
"""

ICONS = {
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    "palette": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9.5" cy="15" r="1.1" fill="currentColor"/></svg>',
    "sun": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    "moon": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    "auto": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 4v13" opacity=".45"/></svg>',
}


# ──────────────────────────────────────────────────────────
# 名字与图标：全都从「这一页叫什么」推出来，任何人不改代码都能用自己的
# ──────────────────────────────────────────────────────────
HONORIFIC = ("老师", "先生", "女士", "同学", "老板", "大大", "总", "哥", "姐",
             "叔", "姨", "君", "酱")
NAME_SUFFIX = re.compile(
    r"\s*(的)?\s*(书签导航|书签夹|书签库|书签站|书签页|书签|导航页|导航|收藏夹|"
    r"收藏|主页|首页|起点)$")
GENERIC_MARK = {"我", "我的", "俺", "俺的", "书", ""}


def derive_mark(title):
    """从页面名字里推出一个字的图标：夜秣的书签→秣，马总的书签→马，老王→王"""
    n = (title or "").strip()
    n = re.sub(r"[（(【\[].*?[)）】\]]", "", n).strip()   # 去掉括号备注
    n = NAME_SUFFIX.sub("", n).strip(" 　·-—|/的是").strip()

    if not n:
        return "书"
    if re.fullmatch(r"[A-Za-z0-9 ._\-']+", n):
        return n[0].upper()                              # 英文名取首字母

    for h in HONORIFIC:                                  # 先剥敬称
        if len(n) > len(h) and n.endswith(h):
            n = n[: -len(h)].strip(" 　·-—|")
            break

    if not n or n in GENERIC_MARK:
        return "书"
    return n[-1] if len(n) >= 2 else n[0]


def mark_style(color=None, hue=None):
    """图标底色：默认跟随当前皮肤主色，也能指定色值或色相"""
    if color and color.lower() not in ("auto", "skin", "primary"):
        c = color if color.startswith("#") else "#" + color
        return ("background:linear-gradient(150deg,color-mix(in srgb,%s 80%%,#ffffff),%s);"
                "box-shadow:0 4px 14px -5px %s" % (c, c, c))
    if hue is not None:
        a = "hsl(%d 74%% 60%%)" % (hue % 360)
        b = "hsl(%d 76%% 44%%)" % ((hue + 18) % 360)
        return "background:linear-gradient(150deg,%s,%s);box-shadow:0 4px 14px -5px %s" % (a, b, b)
    return ("background:linear-gradient(150deg,color-mix(in srgb,var(--primary) 78%,#ffffff),var(--primary));"
            "box-shadow:0 4px 14px -5px color-mix(in srgb,var(--primary) 62%,transparent)")


def ask_title(default="我的书签"):
    """交互式问名字；非交互环境（脚本调用）直接用默认值"""
    if not sys.stdin.isatty():
        return default
    print("─" * 50)
    print(" 给这个书签页起个名字吧，它会显示在左上角和浏览器标签上。")
    print(" 例如：夜秣的书签 / 我的起点 / 老王收藏夹")
    try:
        t = input(" 名字（直接回车用「%s」）：" % default).strip()
    except (EOFError, KeyboardInterrupt):
        t = ""
    return t or default


def ask_mark(derived):
    if not sys.stdin.isatty():
        return derived
    try:
        m = input(" 图标用哪个字（回车用「%s」）：" % derived).strip()
    except (EOFError, KeyboardInterrupt):
        m = ""
    return (m[0] if m else derived)


def read_text(path):
    for enc in ("utf-8", "utf-8-sig", "gbk", "gb18030", "latin-1"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, LookupError):
            continue
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def build(bookmarks_file, out_file, skin="yemo-navy", icons="direct",
          desc_file=None, gh_file=None, title="我的书签",
          mark=None, mark_color=None, mark_hue=None):
    raw = read_text(bookmarks_file)

    p = BookmarkParser()
    p.feed(raw)
    p.close()

    if not p.items:
        print("[!] 没解析出任何书签，确认导出的是「书签 HTML」而不是浏览器里的其他文件。", file=sys.stderr)
        return 0

    items = dedupe(p.items)

    extra = {}
    if desc_file and os.path.exists(desc_file):
        with open(desc_file, "r", encoding="utf-8") as f:
            extra = json.load(f)

    gh = {}
    if gh_file and os.path.exists(gh_file):
        with open(gh_file, "r", encoding="utf-8") as f:
            gh = json.load(f)

    data = []
    for it in items:
        d = domain_of(it["url"])
        # GitHub 仓库简介（可选，提前抓好的 JSON）
        if "github.com" in d and gh:
            m = re.search(r"github\.com/([^/]+/[^/#?]+)", it["url"])
            if m and m.group(1) in gh:
                it["gh_desc"] = gh[m.group(1)]

        nice_name, hint = refine_item(it)
        desc = lookup_desc(d, it, extra)
        if hint:                       # 标题里带的描述最具体，优先用
            desc = hint

        data.append({
            "n": nice_name or d or "(无标题)",
            "u": it["url"],
            "d": desc,
            "c": classify(it),
            "i": pick_icon(it, icons),
        })

    # 分类按数量排序，让主分类排前面
    from collections import Counter
    order = [c for c, _ in Counter(x["c"] for x in data).most_common()]
    rank = {c: i for i, c in enumerate(order)}
    data.sort(key=lambda x: (rank.get(x["c"], 99), x["n"]))

    meta = {
        "skin": skin,
        "icons": icons != "none",
        "generated": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"),
        "count": len(data),
    }

    css = read_text(os.path.join(ASSETS, "app.css"))
    theme_js = read_text(os.path.join(ASSETS, "theme-engine.js"))
    app_js = read_text(os.path.join(ASSETS, "app-engine.js"))

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # 防止书签标题里出现 </script> 把页面炸掉
    payload = payload.replace("</", "<\\/")

    out = (TPL
           .replace("__TITLE__", html_mod.escape(title))
           .replace("__MARK__", html_mod.escape(mark or derive_mark(title)))
           .replace("__MARK_STYLE__", mark_style(mark_color, mark_hue))
           .replace("__TOTAL__", str(len(data)))
           .replace("__GENERATED__", meta["generated"])
           .replace("__CSS__", css)
           .replace("__THEME_JS__", theme_js)
           .replace("__APP_JS__", app_js)
           .replace("__DATA__", payload)
           .replace("__META__", json.dumps(meta, ensure_ascii=False))
           .replace("__ICON_SEARCH__", ICONS["search"])
           .replace("__ICON_PALETTE__", ICONS["palette"])
           .replace("__ICON_SUN__", ICONS["sun"])
           .replace("__ICON_MOON__", ICONS["moon"])
           .replace("__ICON_AUTO__", ICONS["auto"]))

    # 标记默认皮肤，页面首屏用它
    out = out.replace('data-theme="yemo-navy"', 'data-theme="%s"' % skin, 1)
    out = out.replace('localStorage.getItem(YemoSkin.LIGHT.theme) || \'yemo-navy\'',
                      'localStorage.getItem(YemoSkin.LIGHT.theme) || \'%s\'' % skin)

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(out)

    return len(data), len(order)


def main():
    ap = argparse.ArgumentParser(
        description="把浏览器导出的书签 HTML 变成可换肤的卡片式导航页（全本地）")
    ap.add_argument("bookmarks", help="浏览器导出的书签 HTML 文件")
    ap.add_argument("-o", "--out", default=None, help="输出 HTML 路径")
    ap.add_argument("--skin", default="yemo-navy",
                    help="默认皮肤 ID（yemo-navy/clear-green/claude/amethyst/catppuccin/"
                         "kodama/rose/elegant/neo-brutalism/graphite）")
    ap.add_argument("--icons", default="auto",
                    choices=["auto", "inline", "direct", "favicon-im", "google", "none"],
                    help="图标来源：auto=优先用导出文件自带图标，没有再联网抓（默认）；"
                         "inline=全部用自带图标，完全离线")
    ap.add_argument("--desc", default=None, help="补充简介 JSON（域名 -> 简介）")
    ap.add_argument("--gh", default=None, help="GitHub 仓库简介 JSON（repo -> 简介）")
    ap.add_argument("--name", "--title", dest="title", default=None,
                    help="书签页名字（不给就交互式问一次，别人用也能填自己的）")
    ap.add_argument("--mark", default=None,
                    help="左上角图标用哪个字（默认从名字自动推导）")
    ap.add_argument("--mark-color", default=None,
                    help="图标底色，如 #e94b8a；默认跟随皮肤主色")
    ap.add_argument("--mark-hue", type=int, default=None,
                    help="图标底色色相 0-360（想固定一个色系时用）")
    args = ap.parse_args()

    if not os.path.exists(args.bookmarks):
        print("[!] 找不到书签文件：%s" % args.bookmarks, file=sys.stderr)
        return 2

    out = args.out
    if not out:
        base = os.path.splitext(os.path.basename(args.bookmarks))[0]
        out = os.path.join(os.path.dirname(os.path.abspath(args.bookmarks)),
                           "%s-书签导航.html" % base)

    title = args.title or ask_title()
    mark = args.mark or ask_mark(derive_mark(title))

    r = build(args.bookmarks, out, args.skin, args.icons, args.desc, args.gh,
              title, mark, args.mark_color, args.mark_hue)
    if not r:
        return 1

    n, cats = r
    print("[OK] 名称「%s」，图标「%s」" % (title, mark))
    print("[OK] 整理了 %d 个站点，%d 个分类" % (n, cats))
    print("[OK] 输出：%s" % out)
    print("[OK] 直接双击用浏览器打开即可，换肤按钮在右上角「皮肤」")
    return 0


if __name__ == "__main__":
    sys.exit(main())
