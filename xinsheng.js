// ==UserScript==
// @name         心声24小时热门评论
// @namespace    http://tampermonkey.net/
// @version      2025-07-10
// @description  本脚本适用于 华为心声社区的 https://xinsheng.huawei.com/next/plus/ 页面，自动加载全部评论内容并进行提取、排序、美化展示。它解决了页面默认仅加载部分评论、阅读不便的问题，适合想快速了解“24小时最热评论”的用户使用。
// @author       Haojie Huang
// @match        https://xinsheng.huawei.com/next/plus/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=huawei.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // 创建遮罩层，提示用户正在加载评论内容
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background-color: rgba(255,255,255,0.95);
        z-index: 99999;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        font-size: 24px;
        color: #333;
    `;
    overlay.innerHTML = '<div class="loader"></div><br/>插件正在加载全部评论中...';

    // 加载动画样式
    const style = document.createElement('style');
    style.textContent = `
      .loader {
        margin-bottom: 5px;
        border: 6px solid #f3f3f3;
        border-top: 6px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    let previousHeight = 0;
    let stableStartTime = null;
    const STABLE_DURATION = 1000;

    function scrollAndCheckStable(callback) {
        const scrollLoop = () => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
            setTimeout(() => {
                const currentHeight = document.body.scrollHeight;
                if (currentHeight === previousHeight) {
                    if (!stableStartTime) stableStartTime = Date.now();
                    if (Date.now() - stableStartTime >= STABLE_DURATION) return callback();
                } else {
                    previousHeight = currentHeight;
                    stableStartTime = null;
                }
                requestAnimationFrame(scrollLoop);
            }, 300);
        };
        scrollLoop();
    }

    function getContent() {
        const result = {};
        document.querySelectorAll('.ecard').forEach((card) => {
            const contentEl = card.querySelector('.sat-content');
            const titleEl = card.querySelector('.title');
            const likeEl = card.querySelector('.like-txt');
            if (!contentEl || !titleEl || !likeEl) return;

            const content = contentEl.innerText.trim();
            const title = titleEl.innerText.trim();
            const likeCount = parseInt(likeEl.innerText.trim()) || 0;

            if (!result[title]) result[title] = [];
            result[title].push({ content, likeCount });
        });

        return Object.entries(result).map(([title, items]) => {
            const totalLikes = items.reduce((sum, item) => sum + item.likeCount, 0);
            return { title, items, totalLikes };
        });
    }

    let currentSort = 'likes';
    let rawData = [];

    function getReadTitles() {
        try {
            const data = localStorage.getItem('readTitles');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function addReadTitle(title) {
        const readTitles = getReadTitles();
        if (!readTitles.includes(title)) {
            readTitles.push(title);
            localStorage.setItem('readTitles', JSON.stringify(readTitles));
        }
    }

    function renderResults(data) {
        window.scrollTo({ top: 0, behavior: 'instant' });

        document.body.innerHTML = '';

        const topBtn = document.createElement('button');
        topBtn.textContent = '↑ 返回顶部';
        topBtn.style.cssText =
            'position:fixed;bottom:40px;right:40px;padding:10px 14px;background:#0055A5;color:#fff;border:none;border-radius:6px;cursor:pointer;z-index:1000;';
        topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

        const sortBtn = document.createElement('button');
        sortBtn.textContent = '切换排序';
        sortBtn.style.cssText =
            'position:fixed;top:20px;right:40px;padding:10px 14px;background:#008000;color:#fff;border:none;border-radius:6px;cursor:pointer;z-index:1000;';
        sortBtn.onclick = () => {
            currentSort = currentSort === 'likes' ? 'az' : 'likes';
            const sortedData =
                currentSort === 'likes'
                    ? rawData.slice().sort((a, b) => b.totalLikes - a.totalLikes)
                    : rawData.slice().sort((a, b) => a.title.localeCompare(b.title));
            renderResults(sortedData);
        };

        const toc = document.createElement('div');
        toc.style.cssText =
            'position:fixed;top:80px;right:20px;width:200px;background:#f7f7f7;padding:10px;border-radius:8px;z-index:1000;box-shadow:0 2px 6px rgba(0,0,0,0.1);font-size:12px;overflow:auto;max-height:80vh;';
        toc.innerHTML = '<strong>目录</strong><hr/>';

        const container = document.createElement('div');
        container.style.cssText =
            'max-width:900px;margin:60px auto;padding:20px;font-family:Segoe UI,sans-serif;line-height:1.6;color:#333;';

        const readTitles = getReadTitles();

        const tocLinks = [];

        data.forEach((group, idx) => {
            const groupId = `group-${idx}`;
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '40px';
            groupDiv.id = groupId;

            const titleHeader = document.createElement('h2');
            titleHeader.textContent = `${group.title}（总点赞: ${group.totalLikes}）`;
            titleHeader.style.cssText =
                'color:#0055A5;border-bottom:2px solid #0055A5;padding-bottom:6px;margin-bottom:15px;';
            groupDiv.appendChild(titleHeader);

            const link = document.createElement('div');
            link.textContent = group.title;
            link.dataset.title = group.title;
            link.style.cssText = `display: block;padding: 5px 0;color: ${readTitles.includes(group.title) ? '#888' : '#0055A5'};text-decoration: none;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;cursor: pointer;`;
            link.onclick = () => {
                addReadTitle(group.title);
                link.style.color = '#888';
                document.getElementById(groupId)?.scrollIntoView({ behavior: 'smooth' });
            };
            toc.appendChild(link);
            tocLinks.push({ title: group.title, element: link, node: groupDiv });

            group.items
                .sort((a, b) => b.likeCount - a.likeCount)
                .forEach((item) => {
                    const card = document.createElement('div');
                    card.style.cssText =
                        'background:#fff;border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);';

                    const content = document.createElement('p');
                    content.textContent = item.content;

                    const likes = document.createElement('div');
                    likes.textContent = `👍 点赞数: ${item.likeCount}`;
                    likes.style.cssText = 'color:#888;font-size:13px;';

                    card.appendChild(content);
                    card.appendChild(likes);
                    groupDiv.appendChild(card);
                });

            container.appendChild(groupDiv);
        });

        document.body.append(sortBtn, topBtn, toc, container);

        // 滚动监听：判断标题内容是否进入视口
        function checkScroll() {
            const viewportTop = window.scrollY;
            const viewportBottom = viewportTop + window.innerHeight;

            tocLinks.forEach(({ title, element, node }) => {
                if (getReadTitles().includes(title)) return;

                const rect = node.getBoundingClientRect();
                const elementTop = rect.top + window.scrollY;
                const elementBottom = elementTop + rect.height;

                const overlapStart = Math.max(viewportTop, elementTop);
                const overlapEnd = Math.min(viewportBottom, elementBottom);
                const overlap = overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;

                if (overlap > 0.6 * rect.height) {
                    addReadTitle(title);
                    element.style.color = '#888';
                }
            });
        }

        window.addEventListener('scroll', checkScroll);
        checkScroll(); // 初始检查一次
    }

    scrollAndCheckStable(() => {
        rawData = getContent();
        overlay.remove();
        const sorted = rawData.sort((a, b) => b.totalLikes - a.totalLikes);
        renderResults(sorted);
    });
})();
