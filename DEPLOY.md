# 发布到 GitHub Pages

游戏是纯静态网页（HTML + JS + CSS，three.js 从 CDN 加载），不需要构建，GitHub Pages 可以直接托管。发布后的地址形如 `https://<你的用户名>.github.io/<仓库名>/`。

当前是**开发中版本**（`0.1.0-dev`），标题画面底部会显示这一点。

## 第一次发布

1. **决定提交里的作者邮箱。** 仓库里每个提交都带着作者的名字和邮箱，推到公开仓库后任何人都能看到。如果不想公开现在的邮箱，先在 GitHub 的 Settings → Emails 里勾选 "Keep my email addresses private"，拿到 `<id>+<用户名>@users.noreply.github.com` 这个地址，再改写已有提交的作者（见文末）。
2. **选一个许可证（可选）。** 不加许可证时，别人能玩、能看代码，但法律上不能复用。想开放就在仓库根目录加 `LICENSE` 文件（GitHub 新建文件时可选模板，例如 MIT）。
3. **在 GitHub 上新建一个空仓库**，例如 `beneath-the-surface`。选 Public，不要勾选 README、.gitignore 或 License（本地已经有了）。
4. **把本地仓库推上去**（在 `F:\ocean` 里运行，把地址换成你的仓库）：
   ```bash
   git remote add origin https://github.com/<你的用户名>/beneath-the-surface.git
   git branch -M main
   git push -u origin main
   ```
5. **打开 Pages：** 仓库页面 → Settings → Pages → Build and deployment，Source 选 "Deploy from a branch"，Branch 选 `main`，目录选 `/ (root)`，保存。
6. 等一两分钟，页面顶部会出现网址。打开确认能进标题画面、能开始游戏、能潜水。
7. 把网址填进 `README.md` 的"在线试玩"那一行，提交并推送。

## 之后每次更新

1. 改版本号，三处保持一致：
   - `src/boot.js` 里的 `VERSION`
   - `index.html` 里 `src/boot.js?v=…`
   - `index.html` 标题画面的 `devtag` 文字
   版本号一变，玩家的浏览器就会重新下载所有文件，不会卡在旧版本。
2. 跑一遍回归测试：`bash tools/suite.sh`，和 `tools/baseline.txt` 对比。
3. 提交、`git push`。Pages 会在一两分钟内自动更新。

## 说明

- **存档**存在玩家自己浏览器的 localStorage 里，不会上传。数值改动较大时旧存档可能出错，标题画面已提示。
- **three.js** 从 `cdn.jsdelivr.net` 加载。玩家所在网络打不开这个 CDN 时游戏无法启动；需要的话可以把 three.js 下载进仓库，改 `index.html` 里的 importmap 指向本地文件。
- `tools/` 是平衡测试脚本，随仓库公开不影响游戏。

## 改写已有提交的作者邮箱

只在推送到 GitHub **之前**做。在 `F:\ocean` 里运行，把名字和邮箱换成你的：

```bash
git -c user.name="<名字>" -c user.email="<id>+<用户名>@users.noreply.github.com" rebase -r --root --exec "git commit --amend --no-edit --reset-author"
```

然后把以后的提交也设成这个邮箱：

```bash
git config user.email "<id>+<用户名>@users.noreply.github.com"
```
