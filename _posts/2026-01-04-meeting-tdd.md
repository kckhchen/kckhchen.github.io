---
layout: post
date: 2026-01-04
title: 與 TDD 的相遇
categories: [zh]
---


測試驅動開發（Test-Driven Development, TDD）是個我一見鍾情的概念，因為他解決了我長期以來寫程式時碰到的麻煩：
1. 需要不停在 kernel 中重複複製、貼上測試的 code
2. 常常看見 error message 卻難以追溯哪個環節出問題
3. 未來修理一個 bug，因為沒搞清楚 dependencies，卻不小心搞壞整個程式
4. Edge cases 總是想到才測試

TDD 的核心理念就是一句話：「先寫測試，再寫程式」。在開始著手寫任何功能或函式之前，應該要先寫好測試碼，描述我希望獲得的結果，接著再開始撰寫函式，讓函式的輸出結果符合測試的標準。

## TDD 之前

舉我前陣子嘗試用 Ruby 開發的 CLI 西洋棋為例，我希望寫一個 helper function `input_to_coords` 將玩家的輸入的棋盤座標（例如 `a3`）轉換成程式中的 2d array 座標（例如 `[5, 0]` ）。

簡單！許多人腦中應該馬上就有解法了：

```ruby
# class Board
def input_to_coords(input)
  input_array = input.split('')
  col = input_array.first.ord - 'a'.ord
  row = 8 - input_array.last.to_i
  [row, col]
end
```

簡潔優雅。不過當我們打開 `irb` 測試時，馬上就會發現很多問題：首先，我們發現輸入空字串會報錯

```
'Board#input_to_coords': undefined method 'ord' for nil (NoMethodError)
```

所以我們又加上一個 Guard clause 在函式開頭：

```ruby
raise IndexError if input.empty?
```

危機暫時解除。但不久後我們開始測試遊戲時，又發現另一個隱形錯誤，如果座標值超過盤面的話

```ruby
board.input_to_coords('a9')
# => [-1, 0]
```

這可不好。我們需要隨時注意橫坐標（字母）和縱座標（數字）都沒有超出盤面座標才行。於是我們又加了一行在 return 之前的 guard clause：

```ruby
raise IndexError unless col.between?(0, 7) && row.between?(0, 7)
```

到了這時，我們的函式已經越來越難讀了。有兩個在不同地方觸發的 guard clauses。或許當我們終於完成整個遊戲邏輯後，過了半個月，有使用者回報：「我希望輸入 `A6` 時不要報錯，因為我不喜歡小寫的 `a6`。」這時我們回去打開 500 行的 code，已經不知道從何改起，又擔心改變一個函式後，之前小心翼翼守住的所有 error 會不會又找到新的大門鑽出去。而且我們已經忘記當初做過哪些測試，所以無法一一確保我們改動完後，可以重新將半個月前做過的 20 個測試一字不差的跑一遍。

這通常會去許多非 TDD 專案最後會淪落的下場：沒有人膽敢 refactor，只好一直疊床架屋下去，或是就不修了。

## TDD 之後

TDD 要求程式設計師在動手寫任何程式碼之前，先把測試寫好。所以面對同樣一個 `input_to_coords` 函式，我會先創建一個 `spec/board_spec.rb` 的測試檔，並且開始思考：

> 我要這個函式做什麼事？它要收到什麼 input？什麼時候它要給出什麼樣的 output？

首先，空字串當然要擋下來：

```ruby
describe '#input_to_coords' do
  it 'should raise an error if input is empty' do
    board = Board.new
    expect { board.input_to_coords('') }.to raise_error(IndexError)
  end
end
```

接著呢？我們再思考，發現超出盤面的值也要擋下來：

```ruby
  it 'should raise an error if input is out of bound' do
    board = Board.new
    expect { board.input_to_coords('a9') }.to raise_error(IndexError)
  end
```

但當然，如果 input 合法，我們也要讓函式做出正確的事：

```ruby
  it 'should return [7, 0] when the input is a1' do
    board = Board.new
    expect(board.input_to_coords('a1')).to eql([7, 0])
  end
```

現在，我們使用 `rspec` 跑測試檔，會發現**全部失敗**。這是當然的，因為我們還沒有寫任何程式！我們必須先讓紅字出現，確保 1. 我的測試檔自己沒有問題 2. **不應該**出現綠燈。所以全部紅字卻沒有報錯的時候，就代表  TDD 的第一步成功了。之後我們就可以開始寫函式。我們發現，空字串要擋掉，超過座標的也要擋掉，應該還有不少不合法的輸入需要擋，不如我們就直接寫一個 helper function 吧！

```ruby
# class Board
def input_to_coords(input)
  raise IndexError unless input_valid?(input)
  input_array = input.split('')
  col = input_array.first.ord - 'a'.ord
  row = 8 - input_array.last.to_i
  [row, col]
end

private

def input_valid?(input)
  false unless !input.empty? && 
			   input.split('').first.between?('a', 'h') &&
			   input.split('').last.to_i.between?(1, 8)
  true
end
```

再跑一次測試檔，全部綠燈！但當然，這個 `input_valid?` 函式看起來太醜、太囉唆了，但至少我們已經確認我們的邏輯完美。下一步就是重構（refactor）。我們發現 `input_valid?` 這麼多條件，其實可以直接用一個 regex 確認：

```ruby
def input_valid?(input)
  regex = /\A[a-h][1-8]\z/
  regex.match?(input)
end
```

看起來清爽多了！但要小心這次的重構會不會讓我們的遊戲功能壞了，所以重構後再跑最後一次 test————全部綠燈！這就是 TDD 典型的 red-green-refactor 工作流：先讓 test 亮紅燈（red），再用各種方法符合 test 的需求（green），最後在不破壞邏輯的情況下重構程式碼（refactor）。每次要修改程式碼，就是不停的 red-green-refactor 三連拍的重複，就像在打節奏遊戲一樣，意外地療癒！（再加上 Ruby 自然流暢的語法，就像在寫 doc 一樣！）

## TDD 的好處

TDD 的好處在此時就很明顯了：我們已經將所有預期的結果和可能會發生的錯誤「記載」在 spec 上面，因此我們不需要擔心每次手動測試時的方法不一致。而且，在寫 spec 時，我們腦中其實已經開始建構程式碼的邏輯，該做哪些事、哪些該報錯，return 要用什麼 type 呈現，都會在寫 spec 時漸漸成形，反而減少了程式碼未來產生衝突或不相容的問題。

TDD 另外最大的好處就是，假設半個月後那個使用者又來要求加入接受 `A6` 作為 input，我們現在有兩個非常完美的立足點：
1. 因為 TDD 幫助我們寫了 clean code，我們可以馬上找到 `input_valid?` 是我們要 refactor 的對象。
2. 半個月前所有的 tests 都還在，我們在 refactor 後可以馬上測試新的程式碼會不會導致舊有功能失常。因為 tests 已經寫好了，只要一鍵就可以重新測試。

這讓我們有充足的底氣和信心可以在 refactor 的同時不會不小心毀掉原本的功能，因為只要 refactor 後測試亮了紅燈，我們就可以立即知道是哪裡出了問題，是哪個 unit test 出錯了。

那，要如何修補使用者的要求呢？一樣，TDD 告訴我們要先寫一個 failed test：

```ruby
  it 'accepts cap letters as long as the input is valid' do
    board = Board.new
    expect(board.input_to_coords('A6')).to eql [2, 0]
  end
```

跑一次測試，所有舊有的測試應該都要是綠燈，只有這個新的 unit test 是紅燈。接著，我們發現這個問題很好解決：我們要先讓 `input_valid?` 接受大寫，接著在 `input_to_coords` 中轉小寫就好：

```ruby
# class Board
def input_to_coords(input)
  raise IndexError unless input_valid?(input)
  input_array = input.downcase.split('') # <- 改了這裡
  col = input_array.first.ord - 'a'.ord
  row = 8 - input_array.last.to_i
  [row, col]
end

private

def input_valid?(input)
  regex = /\A[a-hA-H][1-8]\z/ # <- 改了這裡
  regex.match?(input)
end
```

再跑一次 test，全部綠燈！當我第一次看到 CLI 跳出那一整排綠色的點時，我感覺到一種前所未有的踏實感。 我不再需要手動輸入座標到 `irb` 測試到手痠，這種『被程式保護著』的開發節奏，讓我真正體會到為什麼 TDD 會讓人一見鍾情。這時我們就可以放心地交貨，知道我們沒有把之前的功能搞砸，因為 TDD 讓我們謹守 clean code 原則，也記錄了我們過往的所有 tests 內容。

## 結論

回到我一開始提出的煩惱，TDD 給出了非常好的回覆：

1. 需要不停在 kernel 中重複複製、貼上測試的 code
   -> 寫一次 test，重復使用
2. 常常看見 error message 卻難以追溯哪個環節出問題
   -> 對於小 function 建立 test，限縮偵錯範圍
3. 未來修理一個 bug，因為沒搞清楚 dependencies，卻不小心搞壞整個程式
   -> 強迫 clean code，且幫我們記得過去的 tests
4. Edge cases 總是想到才測試
   -> 在寫 test 時一併寫進去，以後再也不忘記！

當然，這篇文章還有很多 TDD 的哲學沒有認真講述（例如 bare minimum 原則等等），但這個工作流程是目前最能和急性子的我合作無間的自我改良版。

以前改程式像不穿裝備走鋼索，每改一行代碼都心驚膽顫，深怕在哪個看不見的角落引發了連鎖反應。但自從遇見 TDD 就像有了保護繩，雖然「先寫測試」在初期看似慢了一點，但它賦予我的**開發信心**與**程式碼穩定性**，卻是往後數月甚至數年都受用無窮的。

畢竟，沒有什麼比看到那排綠色的 `.` 更能讓程式設計師睡個好覺了。