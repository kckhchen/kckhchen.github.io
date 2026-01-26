---
layout: post
share: true
title: Ruby 的 Symbol 是什麼？
---

在 Ruby 中，有兩個長相相似但功能完全不同的物件：Symbol 以及 String（字串）。Ruby 是少數有 Symbol 物件的語言，而它的用法也很有趣。

在 Ruby 中，Symbol 長得像是一個由冒號開頭的變數，例如 `:email` 或是 `:username`。跟字串不同，Ruby 以及幾乎所有程式語言中，字串的長相都是由單引號或是雙引號包覆：`"username"` 或是 `'a cool string'`。

這兩個物件的最大差異在於可變性（mutability）：Symbol 是不可變的（immutable），而字串是可變的（mutable）。我們可以直接用一個例子示範：

```ruby
> str = "abc"
#=> "abc"

# 更改部分字串
> str[0] = "b"
> puts str
#=> "bbc"

# append 字串
> str << "d"
#=> "bbcd"
```

我們可以輕易修改一個字串的內容。然而，Symbol 不允許這樣的操作：

```ruby
> sym = :abc
#=> :abc

> sym[0] = "b"
#=> undefined method '[]=' for an instance of Symbol (NoMethodError)

> sym << "a"
#=> undefined method '<<' for an instance of Symbol (NoMethodError)
```

Ruby 並沒有給予 Symbol 更改長相的功能。Symbol 的不可變性給了它一個巨大的優勢：只要是同一個 Symbol，在記憶體中就只會有一個位置。相反的，每個字串，即便內容一樣，在記憶體中是**不同的東西**。我們可以簡單進行下面的實驗：

```ruby
> str1 = "abc"
> str2 = "abc"
> str3 = "abc"

> str1.object_id
#=> 199184
> str2.object_id
#=> 201824
> str3.object_id
#=> 204464
```

這種特性使得字串容易讓我們的記憶體充斥一堆重複物件。但 Symbol 呢？

```ruby
> sym1 = :abc
> sym2 = :abc
> sym3 = :abc

> sym1.object_id
#=> 51294476
> sym2.object_id
#=> 51294476
> sym3.object_id
#=> 51294476
```

我們會發現無論 assign 幾次，`object_id` 都是一樣的。Symbol 物件是獨一無二的，只要有兩個變數儲存的是同一個 Symbol，它們就會指向記憶體的同個位置。

這兩個特性（不可變性和獨一無二）使得 Symbol 非常適合用在儲存物件的「標籤」，而可變且每次儲存位置都不同的字串適合用在儲存物件的「內容」上。

一個最常見的例子就是在 Hash 當中，使用 Symbol 當作 key，並使用字串作為 value：

```ruby
> hash = { :username => "awesome_user" }
```

因為 Symbol 不可變且位置唯一的特性，使得 `:username` 本身不會被意外修改，且查找速度比字串快，因為比起字串的逐字比對，Symbol 可以直接用整數 ID 比對，非常適合作為 key 使用。事實上，由於這個 Hash 的使用方法實在太常用，使得 Ruby 提供了一種更簡便、更直覺易懂的寫法：

```ruby
> hash = { username: "awesome_user" }
# 這跟前方的 hash = { :username => "awesome_user" } 一模一樣
```

這樣的寫法更易懂、且跟大家常見的 JSON 很像，也不用再使用不直覺的 rocket notation `=>`。在這裡 `username` 看起來雖然像是變數，但他卻是一個 Symbol。

## 和 Python 字串比較

聽起來 Symbol 好像是某種 Ruby 特有的奇特物件，不過並非如此。因為 Python 中的 String 正好具有 Ruby Symbol 的功能！我們來看一下 Python 字串物件的特性：

```python
>>> str1 = "abc"
>>> str2 = "abc"

>>> id(str1)
#4338663984
>>> id(str2)
#4338663984
```

沒錯，Python 能夠判定某個字串物件是不是之前已經 assign 過，並且聰明地將新的變數指向記憶體中的同一個位置！並且，Python 的字串就像 Ruby 的 Symbol，是不可變的：

```python
>>> str1[0] = "b"
#'str' object does not support item assignment
```

因此 Ruby 的 Symbol 並不是什麼特別的物件，對於其他語言來說，他的功能就跟字串（幾乎）一模一樣。所以，或許 Ruby 中更令人好奇的是：Ruby 的字串到底為什麼長這樣？

原因之一可能要追溯到 Ruby 發明初期的強項：字串處理。試想今天在 Python 上，每當我們要對字串做處理時，我們每次都會需要重新 assign 一次（因為字串是不可變的）：

```python
>>> old_str = "abc"
>>> new_str = old_str.upper()
>>> new_str
#"ABC"
```

如果今天字串短，當然不是問題，但字串一大，每次 re-assign 就會使得我們的記憶體充斥著許多老舊字串，浪費記憶體空間。但在 Ruby 上就不一樣了：

```ruby
> str = "abc"
> str.object_id
#=> 18360

> str.upcase!
> str
#=> "ABC"
> str.object_id
#=> 18360
```

因爲字串自帶 `#upcase!` 方法，我們令字串使用後，字串就可以「自己修改自己」，但儲存位置完全不變！另外，因為不需要手動 re-assign，Ruby 的程式碼自然看起來乾淨、好讀、順暢多了，正符合 Ruby 當初設計「提升工程師幸福」的哲學。

## Ruby 的 frozen_string_literal: true

字串可變可以說是 Ruby 的一個雙面刃，它給了我們方便簡潔的方法進行字串處理，但卻同時造成兩個問題：

1. 每次 assign 字串，即便內容完全一樣，都會被存在不同的位置，消耗記憶體空間
2. 我們有可能會不小心改變字串內容，使得調用同一個字串的方法得不到預期的 input

因此，Ruby 在版本 2.3 以後開始推行預設字串凍結（freezing），也就是讓字串不可變，讓它們更像 Symbol 的特性。這也就是為什麼現在每一個 `.rb` 檔案的開頭都要先輸入一段*魔法指令*：

```ruby
#frozen_string_literal: true
```

這可以確保這份檔案中的所有字串都預設調用 `#freeze` 方法，之後這個字串物件就不再可變了，如果試圖調用變動字串的方法就會產生 `FrozenError`：

```ruby
> str = "abc"
> str.freeze # irb 中手動使用 #freeze 方法
> str.upcase!
#=> can't modify frozen #<Class:#<String:0x000000012520d480>>: "abc" (FrozenError)
```

這就使得 Ruby 的字串更像是其他語言的字串，也保障了變數的安全性。