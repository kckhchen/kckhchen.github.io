---
layout: post
date: 2026-01-10
math: "true"
title: 從捷運轉乘問題看 SQL SELF JOIN
categories: [zh]
---

SELF JOIN 的問題一直是 SQL 中 JOIN 系列的大魔王。不過 SELF JOIN 也可以讓我們對資料做出很多很有趣的 query。這篇文章中，我從 [SQL Zoo 的公車問題](https://sqlzoo.net/wiki/Self_join) 中汲取靈感，想要用台北捷運的路線轉乘問題來介紹 SELF JOIN 的邏輯和有趣的應用。

## 捷運資料庫

首先我們先介紹這次主要會用到的 table `route`，SQL table 創建的完整指令可以在[我的 GitHub 找到](https://gist.github.com/kckhchen/5e6bfcd220b4cb7d35117215133111f0)。資料內容是我從[台北捷運資料平台](https://data.taipei/dataset/detail?id=733ff034-5a2b-442f-832a-c7d89add0ccb)抓下來整理的。裡面包含台北捷運五條初期路網（紅線、藍線、綠線、橘線、棕線）的 101 個站點資料[^1]。其中 `lineid` 包含路線縮寫（BL, R, G, O, BR），`pos` 則是捷運順向（南向北、西向東）的停靠順序，`station` 則包含所有站點的中文名稱。透過下面的指令我們可以稍微概覽一下資料內容：

```sql
SELECT * FROM route LIMIT 5;
|--------|-----|---------|
| lineid | pos | station |
|--------|-----|---------|
| BR     | 1   | 動物園   |
| BR     | 2   | 木柵     |
| BR     | 3   | 萬芳社區  |
| BR     | 4   | 萬芳醫院  |
| BR     | 5   | 辛亥     |
...
```

## INNER JOIN

在真正開始處理問題前，我們先觀察 SELF JOIN 可以幫我們做什麼事。其實 SELF JOIN 就跟一般的 INNER/LEFT/RIGHT/FULL JOIN 一樣，只是 JOIN 的對象是自己。要怎麼 JOIN 自己呢？在實務上，我們會複製這份 table，然後讓它將那份複製的自己**像是一份獨立的 table** 一樣 JOIN 起來。

這樣做有什麼好處呢？以我們的捷運路線資料來說，我們可以將這份資料與自己 SELF JOIN，並且用 `lineid` 串接看看。兩份 table 分別簡單取名叫 `a` 和 `b` 就好：

```sql
SELECT a.station, a.pos, a.lineid, b.lineid, b.station
FROM route a
INNER JOIN route b ON a.lineid = b.lineid
ORDER BY a.pos, a.station LIMIT 5;
|---------|-----|--------|--------|----------|
| station | pos | lineid | lineid | station  |
|---------|-----|--------|--------|----------|
| 動物園    | 1   | BR     | BR     | 辛亥     |
| 動物園    | 1   | BR     | BR     | 萬芳醫院  |
| 動物園    | 1   | BR     | BR     | 木柵     |
| 動物園    | 1   | BR     | BR     | 萬芳社區  |
| 動物園    | 1   | BR     | BR     | 動物園    |
```

我特地將一樣的 `a.lineid` 和 `b.lineid` 都顯示出來，確定兩個 table 的確是用 `lineid` 串接的。而由於棕線上的每一個站點都有 `BR` 的標籤，所以第一站「動物園」就會被串接上**每一個棕線上的站**（所以才會在資料中重複這麼多次）。當然，第二站「木柵」也會被串接上棕線的每一站。

發現了嗎？這等同於創造了一組「搭同一條線可以抵達的起終點站（包含同站上下車）」組合。無論從哪一站上車、哪一站下車，只要在同一條線上，我們的站點組合都會出現在這份資料中。也就是説，考量到每條路線的站點數量，這份 SELF JOIN 資料總共有 \\(24^2 + 27^2 + 19^2 + 21^2 + 23^2 = 2636\\) 種車站組合！

這就是 SELF JOIN 的強大之處。我們如果想看到**兩列資料並排**的結構，檢視不同列資料之間的關係，SELF JOIN 就可以幫我們完成。有了這樣的基礎，我們就可以開始看一些有趣的應用題目了。

## 轉乘問題

### 1. 哪條線可以到中山？

這只是一個暖身問題，讓我們熟悉資料的結構。我們可以用：

```sql
SELECT lineid FROM route WHERE station = '中山';
|--------|
| lineid |
|--------|
| R      |
| G      |
```

會發現紅線（R）和綠線（G）都會經過中山站。

### 2. 從南邊搭紅線，哪些站可以到中山？

從這題開始就真正進入到 SELF JOIN 的環節了。我們將題目拆解查看需求
1. 搭紅線，所以 `lineid = 'R'`
2. 從南邊出發，所以 `pos` 必須小於中山在紅線的 `pos`

```sql
SELECT a.lineid, a.station AS fromStation, b.station AS toStation
FROM route a
INNER JOIN route b ON a.lineid = b.lineid
WHERE a.lineid = 'R' -- 路線是紅線
  AND b.station = '中山' -- 終點站是中山
  AND a.pos < b.pos -- 確保 pos 低於中山的 b.pos
ORDER BY a.pos; -- 最後由南到北排列
```

也就是說，我們從剛才建立的 SELF JOIN 起訖站組合的資料中，篩選出 1. 紅線 2. 終點站 `b.station` 為中山 3. `pos` 比中山在紅線的 `pos` 還小的所有車站資料。最後由南到北排序。

我們就會得到這個結果：

```
|--------|--------------|-----------|
| lineid | fromStation  | toStation |
|--------|--------------|-----------|
| R      | 象山          | 中山       |
| R      | 台北101/世貿   | 中山       |
| R      | 信義安和       | 中山       |
| R      | 大安          | 中山       |
| R      | 大安森林公園    | 中山       |
| R      | 東門          | 中山       |
| R      | 中正紀念堂     | 中山       |
| R      | 台大醫院       | 中山       |
| R      | 台北車站       | 中山       |
```

當然，我們都知道中山有兩條路線經過（紅綠），所以更有趣的問題應該是：我能不能直接找出哪些車站可以直達中山？

### 3. 哪些車站從南方可以直達中山？

答案意外的簡單——我們只要把對於紅線的限制 `WHERE a.lineid = 'R'` 刪掉就好了，因為 `b.pos` 會依照中山現在是紅線還是綠線而做變化！

```sql
SELECT a.lineid, a.station AS fromStation, b.station AS toStation
FROM route a
INNER JOIN route b ON a.lineid = b.lineid
WHERE b.station = '中山'
  AND a.pos < b.pos -- b.pos 會依照中山在紅線或綠線上而有不同！
ORDER BY a.lineid, a.pos;
```

回去思考 SELF JOIN 的邏輯其實就不會太意外：在做 SELF JOIN 時，我們是用 `lineid` 作為串接節點，因此紅線的中山（還有它的 `pos`）只會被串在紅線的車站上，而綠線站點串接上的是同樣有 `G` 標籤的中山，當然也會一起把綠線中山的 `pos` 帶過去。

因此，我們完全不需要知道哪些線可以到中山，我們只需要透過 `pos` 的篩選，就可以找到所有從西南方（或東北方）出發的所有車站！

我們會得到這樣的答案：

```
|--------|-------------|-----------|
| lineid | fromStation | toStation |
|--------|-------------|-----------|
| G      | 新店         | 中山       |
| G      | 新店區公所    | 中山       |
| G      | 七張         | 中山       |
| G      | 大坪林       | 中山       |
| G      | 景美         | 中山       |
| G      | 萬隆         | 中山       |
| G      | 公館         | 中山       |
| G      | 台電大樓      | 中山       |
| G      | 古亭         | 中山       |
| G      | 中正紀念堂    | 中山        |
| G      | 小南門       | 中山        |
| G      | 西門         | 中山        |
| G      | 北門         | 中山        |
| R      | 象山         | 中山        |
| R      | 台北101/世貿  | 中山        |
| R      | 信義安和      | 中山        |
| R      | 大安         | 中山        |
| R      | 大安森林公園   | 中山        |
| R      | 東門         | 中山        |
| R      | 中正紀念堂    | 中山        |
| R      | 台大醫院      | 中山        |
| R      | 台北車站      | 中山        |
```

（注意到「中正紀念堂」站出現了兩次，因為中正紀念堂也是紅綠線的轉乘站，因此紅線跟綠線各自會顯示一次。）

### 4. 要如何南港展覽館「轉乘一次」到松山？

這題才真正顯示出了 SELF JOIN 的實力，因為 SELF JOIN 可以做不只一次。我們可以透過多次串接，建立更複雜的關係。由於南港展覽館（藍、棕站）到松山（綠站）沒有直達車，中間勢必要經過轉乘。這個題目乍看很複雜，但其實可以簡單拆解成兩個子題：
1. 從南港展覽館直達「轉乘站」
2. 從「轉乘站」直達松山

上面兩題我們都已經做得很熟悉了，各自只需要一次 SELF JOIN 就可以完成。最後，只要再補上一個邏輯考量：兩個「轉乘站」必須是同一站。因此這裡要再多做一次 SELF JOIN。於是連續利用三個 SELF JOIN，我們就可以回答這個問題了：

```sql
SELECT a.station AS fromStation, a.lineid AS line_1 -- 起點和第一段路線
	 , b.station AS transfer -- 轉乘站名
	 , d.lineid AS line_2, d.station AS toStation -- 第二段路線和終點
FROM route a 
INNER JOIN route b ON a.lineid = b.lineid -- 從起點到轉乘站
INNER JOIN route c ON b.station = c.station -- 確保兩個「轉乘站」一樣
INNER JOIN route d ON c.lineid = d.lineid -- 從轉乘站到終點
WHERE a.station = '南港展覽館' AND d.station = '松山' -- 設定起點、終點
  AND a.lineid <> d.lineid; -- 最後確保兩條線不是同一條線，不然就不是轉乘了
```

結果就會顯示成：

```
|-------------|--------|----------|--------|-----------|
| fromStation | line_1 | transfer | line_2 | toStation |
|-------------|--------|----------|--------|-----------|
| 南港展覽館    | BR     | 南京復興   | G      | 松山       |
| 南港展覽館    | BL     | 西門      | G      | 松山       |
```

這個 query 結果真是太美了！我知道我可以從棕線搭到南京復興轉乘綠線，或是從藍線搭到西門轉乘綠線，一目瞭然，而且只用了寥寥幾行的 SQL query！

## 結論

希望這篇文章有讓大家更理解 SELF JOIN 的內部邏輯、應用方法、以及它的魅力。我過往一直都對 SELF JOIN 沒有什麼好感，直到碰到轉乘問題後，才發現 SELF JOIN 真的太好玩也太聰明了，於是迫不及待想寫篇文介紹。

現在，我們可以用同樣的邏輯，提出幾個閱後練習題：
1. 我們能找出從「古亭」到「中山」單次轉乘，總共有多少種搭法嗎？（答案是 4 種！如果算出來是 5 種，小心有一種不能算是「轉乘」）
2. 再多加一條限制就可以解決前一題的問題，但為什麼文中的情況（南港展覽館 > 松山）卻不用？
3. 如果進行「兩次轉乘」，古亭到中山又有幾種搭法？（答案是 12 種！）



[^1]: 為求方便，此資料沒有包含任何支線（小碧潭、新北投），橘線也僅有考慮迴龍方向的車輛。

{% include mathjax.html %}