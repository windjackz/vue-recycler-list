
# vue-recycler-list


## Advantages
- DOM Recycling
- Async Dynamic Height Support, Auto Measure
- Pull Down Refresh And Loadmore Support


## Installation

```
npm install --save vue-recycler-list
```

## Usage

```javascript
import RecyclerList from 'vue-recycler-list';

Vue.component('RecyclerList', RecyclerList);
```

## Example

```javascript
<template>
  <div id="app">
    <div class="main-container">
      <RecyclerList
      uniqueKey="id"
      :itemList="itemList"
      :hasMore="hasMore"
      :usePullDownRefresh="true"
      @loadmore="onLoadMore"
      @refresh="onRefresh"
      >
        <template slot="item" slot-scope="props">
          <li class="chat-item" @click="onItemClick(props)">
            <img class="avatar" width="48" height="48" :src="props.data.avatar">
            <div class="bubble">
                <p>{{props.data.message}}</p>
                <img width="400" height="300" :class="{invisible:!props.data.photo}" :src="props.data.photo">
                <div class="meta">
                    <time class="posted-date">{{props.data.createAt}}</time>
                </div>
            </div>
          </li>
        </template>
        <template slot="footer">
          <div v-show="showLoading">
            loading...
          </div>
        </template>
    </RecyclerList>
    </div>
  </div>
</template>
```
## Props

|key|description|defualt|type/options|
|:---|---|---|---|
|`itemList`|List data of RecyclerList|[]|Array
|`uniqueKey`|Field in item data, used to identify items and optimize rendered for 'v-for' of Vue.|'id'|String|
| `estimatedItemHeight`|list item estimated height|68|Number|
|`hasMore`|Use build-in loadmore feature or not.|false|Boolean|
|`loadawayItems`|Trigger the 'loadmore' event when the list items to be displayed are less than loadawayItems.|10|Number|
|`runawayItems`|The number of items beyond visable items.|5|Number|
|`opsrunawayItems`|The number of items above visable items.|5|Number|
|`usePullDownRefresh`|Use build-in pull down refresh feature or not.|false|Boolean|
|`pullDownOffset`|The value of pixels of pull down to trigger 'refresh' event.|80|Number|
|`pullDownTips`|The text of pull down to refresh.|'Pull to refresh'|String|
|`pullDownReleaseTips`|The text of release to refresh.|'Pull to refresh'|String|
|`pullDownLoadingTips`|The text of loading.|'Loading'|String|

## Events
- loadmore : emitted when the list items to be displayed are less than the loadawayItems.

- refresh : emitted when the value of pixels of pull down large than the pullDownOffset.

## Slots

- item
- footer








