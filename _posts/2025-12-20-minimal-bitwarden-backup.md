--- 
layout: default 
title: "Minimalistic Bitwarden Backup Tool" 
date: 2025-12-20
---

# 用 Shell Script 輕鬆打造 Bitwarden 備份工具

相信大家都跟我一樣是 Bitwarden 的愛用者（如果你不是，希望你至少有使用任何一種密碼管理員），並且享受它的開源、整合 MFA、雲端同步，以及離線存取等功能。但我想也有許多人與我有同樣的擔憂：將密碼全部交給 Bitwarden 保管在雲端，哪天突然無法離線存取密碼，或無法登入 Bitwarden 怎麼辦？

Bitwarden 將密碼儲存在雲端伺服器，讓用戶享受到裝置同步的便利，然而雖然它有離線存取功能，Bitwarden 的密碼卻是以加密的暫存檔（cache）的方式儲存在裝置上，並且離線使用 30 天後就會過期。為了保障我們總是保有對密碼的存取權，我們就需要定期備份密碼。

備份密碼又衍生了許多問題：匯出後的備份檔案全嗎？多久需要備份一次？如果忘記備份怎麼辦？定期備份產生出這麼多的備份檔要怎麼管理？

這些問題讓許多人望之卻步，也就乾脆放棄使用 Bitwarden 和其他密碼管理員。但這件問題其實是可以解決的！

Bitwarden 官方提供了命令介面（CLI）工具 `bitwarden-cli`，讓我們可以利用 Shell Script 輕鬆自己撰寫好用的備份工具，讓我們可以將整個備份旅程從頭到尾（定期提醒 → 一鍵備份 → 加密保護備份 → 自動清除老舊備份檔案）一條龍輕鬆完成！從此再也不會忘記備份密碼檔案，並且在任何有需要卻無法登入 Bitwarden 的時候，都可以從備份檔中輕鬆撈回自己的密碼！

以下將會一步一步介紹如何自己打造一個安全透明的定期備份精靈，也會在文章的最後附上我的 Shell Script 供有需要的人使用。

（以下將以 macOS 為使用情境為準，部分工具和指令在 Windows 或 Linux 系統上可能有所不同，請自行依照需求調整。）
## 事前準備

使用 Shell Script 備份僅需要一個命令工具，也就是 `bitwarden-cli`。它可以用來登入、驗證、匯出加密檔案。`bitwarden-cli` 的詳細使用說明可以參照[官方文件](https://bitwarden.com/help/cli/)。我們這次僅會用到其中幾種常見指令。官網有 `bitwarden-cli` 的[簡易安裝檔](https://bitwarden.com/help/cli/#download-and-install)，或者 macOS 也可以透過 `npm` 指令安裝：

```bash
npm install -g @bitwarden/cli
```

但在開始撰寫 Shell Script 之前，我們需要先從 Bitwarden 官方取得我們帳號的 API key。這可以讓我們在命令列直接與 Bitwarden 互動，而不需要透過 App 或是網頁擴充功能。取得 API key 的方法可以參照[這份官方文件](https://bitwarden.com/help/personal-api-key/)。請注意我們需要兩個要素：`client_id` 和 `client_secret`。前者是公開的資訊（就像你的帳號），而後者是私密資訊，請務必小心保管！

有了 API key 之後，我們可以創建一個 `.env` 文件存放。在想要存放文件的位置使用下列指令：
```bash
cd path/to/dir
touch .env
```
將 `path/to/dir` 替換為你希望存放 Shell Script 檔案的位置。之後用文字編輯軟體（TextEdit、VSCode、TextMate、Nano 等）打開文件，把我們的 API key 裝進去：
```bash
export BW_CLIENTID="client_id"
export BW_CLIENTSECRET="client_secret"
```
將 `client_id` 和 `client_secret` 替換成自己的 API key 後儲存檔案。之後在資料夾中使用下列指令：
```bash
chmod 600 .env
```
這個指令會限制 `.env` 的存取權限，僅有檔案的擁有者（也就是你）可以打開、閱覽、編輯這份檔案，其他使用者都無法打開。另外，即便發現自己的 API key 有被盜用的危機，也不用擔心，只要登入 Bitwarden 網站就可以重新生成一組 `client_secret`，並自動使舊的 API key 作廢。另外，即便對方取得你的 API key，只要沒有你的 Bitwarden master password，也是完全無法使用或存取你的密碼庫的，在安全方面 Bitwarden 確實做得非常到位。 

前置作業完成後，就可以開始寫 Script 了！

## 撰寫腳本

這份腳本主要會有四大步驟：1. 登入 2. 解鎖 3. 取得登入階段 4. 匯出密碼。

### 登入

我們先把剛才的 API key 匯入腳本中：
```bash
source .env
```

`bitwarden-cli` 的登入指令是：
```bash
bw login
```
就這麼簡單！不過，預設的登入方式會要求你輸入 Bitwarden 的註冊信箱和 master password，太麻煩了，我們直接請 API key 幫我們登入：
```bash
bw login --apikey
```
此時我們剛才存在 `.env` 當中的 API key 就派上用場了！輸入這個指令後，Bitwarden 會自動讀取腳本環境中的 `BW_CLIENTID` 和 `BW_CLIENTSECRET` 變數，如果資料正確就會自動登入，完全不用動一根手指！

### 解鎖

不過誠如剛才所說，要能夠存取密碼，我們還需要**解鎖**我們的密碼庫，這時就需要使用到我們的 master password。使用這個指令可以解鎖：
```bash
bw unlock
```
但先不要使用這個指令，我們不只要解鎖而已！

### 取得登入階段

Bitwarden CLI 在解鎖之後，會給你一段階段代碼（session key）用以證明你已經成功登入。從解鎖之後到使用指令上鎖、登出，或關閉目前的 CLI 前，只要提供 Bitwarden 這段 session key，就可以進行所有帳戶操作而不用再輸入 master password，就像是臨時通行證一樣！

如果單純使用 `bw unlock`，Bitwarden 會在命令列要求我們輸入 master password。輸入正確後，會回傳一段很長的 session key 給我們，長得可能像這樣：
```
BW_SESSION="IGJicWrJXTiHFhmF0f/8uzYqSzyM7SDfVWrgfwISBzHV8mRRaJyhuTPJALgoBmCgUr9q3wnk7Ccv7locu5AYjw=="
```
接著，它會要求我們廣播（export）這份 session key，讓後續指令使用。我們可以將這兩步驟結合成一步：
```
export BW_SESSION=$(bw unlock --raw)
```
這段指令會先執行 `$()` 內的 `bw unlock --raw`，其中 `--raw` 會讓 Bitwarden 在驗證完成後直接回傳 session key 字串，之後這個字串會再被 `BW_SESSION` 接收，並使用 `export` 廣播給後續指令使用。很酷吧！

從現在開始我們才能大展拳腳，因為所有指令都能自由使用了。使用指令時，指令會尋找在腳本的環境中的 `BW_SESSION`，只要確認正確，就會直接執行指令，不需要再要求 master password。

### 匯出密碼

這是最關鍵的一步！匯出密碼的常用指令如下：
```
bw export --format --password --output
```
我們一項一項解釋：`--format` 要求我們輸入匯出格式，常用的有 `json`、`encrypted_json` 和 `csv`。為了保障我們的密碼安全，這裡建議使用 `encrypted_json`。接著，`--password` 是專門配合 `encrypted_json` 的參數，要求我們設定這個加密檔案的密碼。最後，`--output` 要求我們輸入密碼檔案的匯出路徑。當我們都決定好之後，就可以開始匯出：
```
bw export --format encrypted_json --password "my-powerful-password" --output "~/Backups/Backup-$(date +%F).json"
```
請將 `my-powerful-password` 換成自己的密碼！而且請務必和 master password 一樣堅固，否則就有機會成為被盜取密碼的破口！另外 `~/Backups/Backup-$(date +%F).json` 會將備份檔案儲存在使用者根目錄之下的 `Backups` 資料夾，並且檔案會命名為 `Backup-yyyy-mm-dd.json`，也就是備份的日期。假設今天是 2025 年 12 月 20 日，備份資料就會是 `Backup-2025-12-20.json`，方便我們知道何時備份了密碼。如果需要更改儲存位置也請自行在此更改。

> [!warning] （警告：利用此種方法設定密碼有一個致命缺點，也就是備份檔案的密碼會以純文字的形式存在這份 Shell Script 當中，也就是若有人開啟這份 Shell Script 就可以直接讀到你的備份檔案密碼！其實這裡也可以再叫出一個 prompt 讓使用者自行輸入每次的密碼，不過就不在本次的介紹範圍中。總之若要自己從頭建立這份 Shell Script，請務必使用額外的加密管道保障自己的安全！）另外，文章最後提供的工具包可以很大一部分減輕這個指令帶來的風險。

### 登出

這樣就大功告成了！使用完成後別忘了登出：
```
bw logout
```
登出後當次的 session key 就會失效，確保我們的帳戶安全。（如果忘記登出，關閉 CLI 介面後 Bitwarden 也會自動登出）。

### 包裝腳本

我們將上面的指令內容全部集合在一份 `bitwarden-backup.sh` 的 Shell Script 當中，並在 Shell Script 第一行加上 `#!/bin/zsh`（讓電腦知道要用哪個軟體跑腳本）：
```bash
#!/bin/zsh

cd path/to/dir
source .env
bw login --apikey
export BW_SESSION=$(bw unlock --raw)
bw export --format encrypted_json --password "my-powerful-password" --output "~/Backups/Backup-$(date +%F).json"
bw logout
```

並且從 CLI 使用指令：
```bash
chmod +x path/to/dir/bitwarden-backup.sh
```
這條指令可以讓我們未來直接運行這份腳本，不用打開一條一條複製貼上（也就是給腳本執行的權限）。以後想要備份資料時，只要使用 CLI 進入（`cd`）腳本所在的資料夾，並使用：
```bash
./bitwarden-backup.sh
```
或是直接輸入絕對路徑：
```bash
path/to/dir/bitwarden-backup.sh
```

所有指令就會自動運行了！（當然你還是要輸入 master password）完美實現一鍵安全備份！

## 設定排程提醒

備份變容易是一回事，會記得備份就是另一回事了。要怎麼樣才能讓電腦提醒我們自動備份呢？這時我們可以利用 macOS 系統裡自帶的 cron 進行定期任務。cron 特殊的表示法，可以固定週期地運行某個腳本指令。cron 表示法非常簡單：
```
* * * * * path/to/script
```
五個米字號分別代表「分、時、日、月、星期」。只要將米字號換成對應的數字，只要時間全數符合標準，後面的腳本就會運行。舉例而言，如果我希望每天下午三點半運行腳本 `test.sh`，我就使用
```
30 15 * * * /path/to/test.sh
```
或是，如果我希望每個月一號中午十二點運行 `test.sh`，我就使用
```
0 12 1 * * /path/to/test.sh
```
當然，這個表示法還有很多不同的用法，如果沒有辦法拼出自己要的，[crontab guru](https://crontab.guru/)是個非常好的查詢網站（或是直接問 AI 也可以XD)，由於 cron 不是本次介紹的重點，關於它的介紹在這裡就點到為止。

有了 cron 之後，我們就可以來寫一份迷你的提醒腳本 `backup-alert.sh`（如果你不介意時間到就會有 CLI 介面飛到你臉上也可以直接連到主要腳本XD）。不過為了方便電腦送通知給我們，我們需要用到 `terminal-notifier` 這份[小工具](https://github.com/julienXX/terminal-notifier)。macOS 使用者可以利用 Homebrew 進行安裝：
```bash
brew install terminal-notifier
```

`terminal-notifier` 非常簡單好用，基本常用指令如下：
```bash
terminal-notifier -title -message -execute
```
其中 `-title` 後面輸入通知標題，`-message` 是通知內容，`-execute` 則是點擊通知後要運行的 CLI 指令。例如：
```bash
terminal-notifier -title "Backup Reminder" -message "Click here to start your backup" -execute "open -a Terminal \"path/to/dir/bitwarden-backup.sh\""
```

也就是說，這份 Shell Script 運行時會傳送一個通知到電腦上，而當我們點擊通知後，它就會運行一段指令：`open -a Terminal` 打開 CLI 介面，並且使用 `path/to/dir/bitwarden-backup.sh` 呼叫備份 Shell Script。我們最後只需要在打開的 CLI 介面中輸入 master password 就完成了！

### 組裝腳本

最後是大組裝的階段。我們先將 `backup-alert.sh` 寫成如下，並存在和 `bitwarden-backup.sh` 一樣的資料夾下：
```bash
#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
terminal-notifier -title "Backup Reminder" -message "Click here to start your backup" -execute "open -a Terminal \"path/to/dir/bitwarden-backup.sh\""
```
其中的 `export PATH="..."` 非常重要，因為 cron 在自動運行時，不像我們使用的 CLI 介面這麼聰明，沒有非常明確的指示，它不知道 `terminal-notifier` 指令在哪裡，所以需要加上一個 `PATH` 變數讓它認路，這個變數不需要修改，保持原樣就好。之後老樣子，我們要給這份腳本執行權限：
```bash
chmod +x /path/to/dir/backup-alert.sh
```

最後，在 CLI 中編輯管理排程的 `crontab`，輸入：
```bash
crontab -e
```
裡面輸入我們希望他運行的週期，我個人建議每個月備份一次，因此設定在每月第一天的中午十二點：
```
0 12 1 * * /path/to/dir/backup-alert.sh
```
存檔後關閉文件，並且在彈出視窗中允許 cron 運行的權限就可以了。

## 大功告成

這樣所有的設定就完成了！現在你的資料夾當中應該會有三份檔案：負責備份的 `bitwarden-backup.sh`、負責提醒的 `backup-alert.sh`，以及存著 API key 的 `.env`。另外，`crontab` 文件當中應該會有一串呼叫 `backup-alert.sh` 的指令。未來的工作流程大概會像這樣：

每個月一日中午十二點（或你設定的時間） → 收到通知 → 點擊通知 → 跟隨指示輸入 master password → 腳本自動完成匯出並結束

就是這麼輕鬆方便！我們同時享受了 Bitwarden 雲端同步的好處和密碼管理員的安全性，也透過定期自動提醒備份在電腦儲存空間中存了受密碼保護的備份檔。如此一來，便可以安心享受 Bitwarden 帶來的便利性，也不用提心吊膽了！

## 能不能更進一步？

當然可以！上面所介紹的腳本非常陽春，基本上還是需要我們動手在 CLI 介面輸入 master password，並且會有許多的 CLI 通知在介面上跑來跑去。因此我透過上方介紹的架構，設計了[完整的自動備份小工具](https://github.com/kckhchen/Minimalistic-Bitwarden-Backup)。這份小工具在初始設定完成後，我們從此不用再和 CLI 打交道，所有個備份、通知、密碼輸入，都可在 macOS 原生的 GUI 對話視窗中完成！這份小工具甚至會定期幫我們打掃備份資料夾，只留下最近幾份備份檔案，將老舊備份刪除，避免空間浪費，也加強密碼安全。

另外，有時候 Bitwarden CLI 會因為不明原因驗證失敗（回傳空的 session key），如果你發現腳本偶爾沒反應，這可能是原因之一。我的進階版工具中加入了自動重試機制來解決這個問題。

如果你對更深入的完整開發有興趣，歡迎去看看我的原始碼，如果有任何問題或是建議，也歡迎跟我說～

