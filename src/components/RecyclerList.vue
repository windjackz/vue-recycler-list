<template>
  <div class="root" ref="root">
    <div class="downwarp"
      ref="downwarp"
      :class="{ 'pull-top-animation': pullAnimationMove }"
      :style="{ height: `${pullDistance}px` }"
      @transitionend="transitionEnd"
      >
      <slot name="pullDown">
        <div class="downwarp-content">
          <p class="downwarp-progress"
            :class="{ 'rotate': pullStatus === 'loading' }"
            :style="{ transform: `rotate(${pullDownRotate}deg)` }"
          ></p>
          <p class="downwarp-tip">{{ pullDownTipsText }}</p>
        </div>
      </slot>
    </div>
    <div class="virtual-list-view" ref="viewport"
      @scroll="fnScroll"
      >
        <!--scroll bar occupation-->
        <div class='virtual-list-view-phantom' :style="{height: contentHeight}"></div>
        <!--visable area-->
        <div class="virtual-list-view-content" ref="content">
          <div ref="items">
            <div 
              v-for="(item) in visibleDataList"
              :key="item[uniqueKey]"
            >
              <slot name="item" :data="item" ></slot>
            </div>
            <div 
              v-for="(item) in unVisibleDataPoolList"
              :key="item[uniqueKey]"
              class="item-invisible"
            >
              <slot name="item" :data="item"></slot>
            </div>
          </div>
          <slot name="footer"></slot>
        </div>
    </div>
  </div>
</template>

<script>
import { rAFthrottle } from '../utils';
import ResizeObserver from 'resize-observer-polyfill';
const PULL_DOWN_STATUS = {
  none: 'none',
  canLoading: 'canLoading',
  loading: 'loading'
}
const UP_DOWN_STATUS = {
  none: 'none',
  loading: 'loading'
}
const EVENTS = {
  loadmore: 'loadmore',
  refresh: 'refresh'
}
export default {
  name: 'RecyclerList',
  props: {
    estimatedItemHeight: {
      type: Number,
      default: 68
    },
    itemList: {
      type: Array,
      required: false,
      default() {
        return []
      }
    },
    hasMore: {
      type: Boolean,
      default: false
    },
    runawayItems: {
      type: Number,
      default: 5
    },
    opsrunawayItems: {
      type: Number,
      default: 5
    },
    loadawayItems: {
      type: Number,
      default: 10
    },
    uniqueKey: {
      type: String,
      default: 'id'
    },
    usePullDownRefresh: {
      type: Boolean,
      default: false
    },
    pullDownOffset: {
      type: Number,
      default: 80
    },
    pullDownTips: {
      type: String,
      default: 'Pull to refresh'
    },
    pullDownReleaseTips: {
      type: String,
      default: 'Release to refresh'
    },
    pullDownLoadingTips: {
      type: String,
      default: 'Loading'
    },
  },
  data: function () {
    return {
      poolSize: 0, // pool size of item in list, auto calculated
      maxPageSize: 0, // max item count on a screen,  auto calculated
      visibleDataList: [],
      unVisibleDataPoolList: [],
      lastScollerTop:0,
      nodesItemArr:[],
      curAncharItem: {
        index: 0,
        offset: 0
      },
      screenHeight: 0,
      scrollHeight: 0,
      // properties for pull down refresh or load more
      upStatus: UP_DOWN_STATUS.none,
      fnScroll: () => {},
      pullDistance: 0,
      pullStatus: PULL_DOWN_STATUS.none,
      pullAnimationMove: false 
    }
  },
  created: function () {
    this.fnScroll = rAFthrottle(this.onListScroll, 16.6 , {leading:true, trailing:true});
  },
  methods: {
    onListScroll: function() {
      if (this.pullDistance) {
        return;
      }
      const self = this;
      const force = self.forceUpdate || false;
      const scrollTop = self.$refs.viewport.scrollTop;
      const delta = scrollTop - self.lastScollerTop;
      if (self.needMeasureItems) {
        self.onMeasureItems(self.$refs.items.children);
      }
      const ancharItem = self.calculateAnchoredItem(self.curAncharItem, delta);
      const lastAncharItem = self.calculateAnchoredItem(ancharItem, self.screenHeight);
      self.updateVisableData(scrollTop, ancharItem, lastAncharItem, force);
      self.curAncharItem = ancharItem;
      self.lastScollerTop = scrollTop;
      // loadmore
      if( self.itemList.length 
          && lastAncharItem.index + this.loadawayItems > self.itemList.length 
          && self.upStatus !== UP_DOWN_STATUS.loading
          && self.hasMore) {
        self.upStatus = UP_DOWN_STATUS.loading;
        self.$emit(EVENTS.loadmore);
      }

    },
    // measure items size
    onMeasureItems: function(nodes) {
      const nodesItemArr = this.nodesItemArr;
      const startIdx = this.curAncharItem.index;
      let totalDelta = 0;
      for (let i=0; i<nodes.length; i += 1) {
        let targetIdx = 0;
        if (i >= this.visibleDataList.length) { //fix idx 
          targetIdx = startIdx - (nodes.length - i);
          break;
        }else {
          targetIdx = startIdx + i;
        }
        const node = nodes[i];
        const item = nodesItemArr[targetIdx] || { height : 0 };
        const delta = node.clientHeight - item.height;
        if (delta) {
          nodesItemArr[targetIdx] = {
            height: node.clientHeight
          }
          totalDelta += delta;
        }
      }
      this.updateScrollHeight(totalDelta);
      this.needMeasureItems = false;
    },
    fillItemsEstimateHeight: function() {
      // update cache height
      const itemList = this.itemList;
      const nodesItemArr = this.nodesItemArr;
      if(itemList.length != this.nodesItemArr.length) {
        if(itemList.length > this.nodesItemArr.length) {
          const estimateHeight = this.estimatedItemHeight;
          let totalDelta = 0;
          while (nodesItemArr.length < itemList.length) {
            nodesItemArr.push({
              height: estimateHeight
            });
            totalDelta += estimateHeight;
          }
          this.scrollHeight += totalDelta;
        }else {
          const diffCount = this.nodesItemArr.length - itemList.length;
          let totalDelta = 0;
          for(let i = 0; i < diffCount; i += 1) {
            totalDelta += nodesItemArr[nodesItemArr.length - 1 - i].height;
          }
          this.nodesItemArr.splice(this.nodesItemArr.length - diffCount, diffCount);
          this.scrollHeight -= totalDelta;
        }
      } 
    },
    updateVisableData: function(scrollTop, ancharItem, lastAncharItem, force) {
      const self = this;
      if(force || ancharItem.index != self.curAncharItem.index || this.visibleDataList.length < lastAncharItem.index - ancharItem.index) {
        // update pageSize
        let pageSize = lastAncharItem.index - ancharItem.index + 1;
        if(pageSize > this.maxPageSize) {
          this.maxPageSize = pageSize;
        }
        // update poolSize
        let estimatePoolSize = this.maxPageSize + this.runawayItems  + this.opsrunawayItems; // cur,pre,next
        if(estimatePoolSize > this.poolSize){
          this.poolSize = estimatePoolSize;
        }
        // calculate poolSize
        let currentPoolSize = this.poolSize;
        if(self.itemList.length < pageSize){
          currentPoolSize = self.itemList.length;
        }
        let contentOffset = 0;
        contentOffset = scrollTop - ancharItem.offset;
        // calculate visable data
        let dataList = [];
        let nextDataList = [];
        let preDataList = [];
        if(currentPoolSize === self.itemList.length){
          dataList = self.itemList.slice(ancharItem.index, self.itemList.length);
           this.unVisibleDataPoolList = [];
        }else{
          const endPos = ancharItem.index + pageSize;
          dataList = self.itemList.slice(ancharItem.index, endPos);
          //next screen data
          const nextStartPos = endPos;
          const nextEndPos = Math.min(endPos + this.runawayItems, self.itemList.length);
          if(nextStartPos !== nextEndPos) {
            nextDataList = self.itemList.slice(nextStartPos, nextEndPos);
          }
          //pre screen data
          const preDataSize = currentPoolSize - dataList.length - nextDataList.length;
          const preEndPos = ancharItem.index;
          const preStartPos = Math.max(0, preEndPos - preDataSize);
          preDataList = self.itemList.slice(preStartPos, preEndPos);
          this.unVisibleDataPoolList = preDataList;
          dataList = dataList.concat(nextDataList);
        }
        self.visibleDataList = dataList;
        self.$refs.content.style.webkitTransform = `translate3d(0, ${ contentOffset }px, 0)`;
        this.forceUpdate = false;
        return contentOffset;
      }
      return scrollTop;
    },
    updateScrollHeight: function(delta) {
      if (delta) {
        this.scrollHeight += delta;
      }
    },
    calculateAnchoredItem: function(initialAnchor, delta) {
      if (!delta) return initialAnchor;
      const dir = delta > 0 ? 1 : -1;
      delta += initialAnchor.offset;
      let idx = initialAnchor.index;
      if (dir > 0 && delta > 0) {
        while (delta > 0 && idx < this.nodesItemArr.length && delta > (this.nodesItemArr[idx].height || this.estimatedItemHeight)) {
          delta -= this.nodesItemArr[idx].height;
          idx += 1;
        }
      } else {
        while (delta < 0 && idx > 0 && this.nodesItemArr[idx - 1].height) {
          delta += this.nodesItemArr[idx - 1].height;
          idx -= 1;
        }
      }
      if (idx >= this.nodesItemArr.length ) {
        idx = this.nodesItemArr.length - 1;
      }
      return {
        index: idx,
        offset: delta,
      };
    },
    // pull down refresh region
    touchStart: function(event) {
      if (event && event.type === 'mousedown') {
        this.$refs.root.addEventListener('mousemove', this.touchMove);
      }
      this.pullAnimationMove = false;
      const point = this.getPoint(event);
      this.touchStartPoint = {
        startX: point.x,
        startY: point.y
      }
      this.lastMovePoint = this.touchStartPoint;
      this.startHeight = this.$refs.downwarp.offsetHeight || 0;
      this.startScroll = this.$refs.viewport.scrollTop || 0;
    },
    touchMove: function(event) {
      if (!this.touchStartPoint) return;
      const point = this.getPoint(event);
      const isDown = point.y - this.lastMovePoint.startY > 0;
      if (isDown) {
        const scrollTop = this.$refs.viewport.scrollTop;
        if (scrollTop <= 0) {
          if (event && event.cancelable && !event.defaultPrevented) event.preventDefault();
          if (this.startScroll > 0 || scrollTop < 0) {
            return;
          }
        }
      }
      this.lastMovePoint = {
        startX: point.x,
        startY: point.y
      };
      const diff = point.y - this.touchStartPoint.startY - this.startScroll;
      if (diff < 0 ) {
        return;
      }
      this.pullDistance = this.startHeight + Math.pow(diff, 0.8);
      if (this.pullDistance > this.pullDownOffset) {
        this.pullStatus = PULL_DOWN_STATUS.canLoading;
      } else {
        this.pullStatus = PULL_DOWN_STATUS.none;
      }
    },
    touchEnd: function(event) {
      if (event && event.type === 'mouseup') {
        this.$refs.root.removeEventListener('mousemove', this.touchMove);
      }
      this.touchStartPoint = null;
      if (this.pullStatus === PULL_DOWN_STATUS.canLoading) {
        if (this.pullDistance > this.pullDownOffset)
          this.pullStatus = PULL_DOWN_STATUS.loading;
          this.pullAnimationMove = true;
          this.pullDistance = this.pullDownOffset;
          this.$emit(EVENTS.refresh);
      } else if (this.pullStatus === PULL_DOWN_STATUS.none && this.pullDistance) {
        this.pullAnimationMove = true;
        this.pullDistance = 0;
      }
    },
    transitionEnd: function() {
      this.pullAnimationMove = false;
    },
    getPoint: function(event) {
      return {
        x: event.touches ? event.touches[0].pageX : event.clientX,
        y: event.touches ? event.touches[0].pageY : event.clientY
      }
    },
    endPullDown: function() {
      this.pullAnimationMove = true;
      this.pullStatus = PULL_DOWN_STATUS.none;
      this.pullDistance = 0;
    },
    rigisterPullDownListeners() {
      this.$refs.root.addEventListener('touchstart', this.touchStart);
      this.$refs.root.addEventListener('touchmove', this.touchMove, {passive: false});
      this.$refs.root.addEventListener('touchend', this.touchEnd);
      this.$refs.root.addEventListener('mousedown', this.touchStart);
      this.$refs.root.addEventListener('mouseup', this.touchEnd);
      this.$refs.root.addEventListener('mouseleave', this.touchEnd);
    },
    removePullDownListeners() {
      try {
        this.$refs.root.removeEventListener('touchstart', this.touchStart);
        this.$refs.root.removeEventListener('touchmove', this.touchMove);
        this.$refs.root.removeEventListener('touchend', this.touchEnd);
        this.$refs.root.removeEventListener('mousedown', this.touchStart);
        this.$refs.root.removeEventListener('mouseup', this.touchEnd);
        this.$refs.root.removeEventListener('mouseleave', this.touchEnd);
      } catch (err) {
        window.console.log(err);
      }
    }
  },
  computed: {
    contentHeight() {
        return this.scrollHeight  + 'px';
    },
    visibleCount() {
      return Math.ceil(this.screenHeight / this.estimatedItemHeight);
    },
    pullDownRotate() {
      return this.pullDistance / this.pullDownOffset * 720;
    },
    pullDownTipsText() {
      const status = this.pullStatus;
      if (status === PULL_DOWN_STATUS.canLoading) {
        return this.pullDownReleaseTips;
      } else if (status === PULL_DOWN_STATUS.loading) {
        return this.pullDownLoadingTips;
      }
      return this.pullDownTips;
    }
  },
  watch: {
    itemList: function () {
      this.upStatus = UP_DOWN_STATUS.none;
      if (this.pullStatus === PULL_DOWN_STATUS.loading) {
        this.endPullDown();
      }
      this.fillItemsEstimateHeight();
      this.forceUpdate = true;
      this.onListScroll();
    },
    usePullDownRefresh: function(newValue) {
      if (newValue) {
        this.rigisterPullDownListeners();
      } else {
        this.removePullDownListeners();
      }
    }
  },
  updated: function() {
    this.needMeasureItems = true;
  },
  mounted: function() {
    this.screenHeight = this.$refs.viewport.offsetHeight;
    this.onListScroll();
    const ro = new ResizeObserver(() => {
      this.needMeasureItems = true;
    });
    ro.observe(this.$refs.content);
    this.ro = ro;
    if (this.usePullDownRefresh) {
      this.rigisterPullDownListeners();
    }
  },
  beforeDestroy(){
    if(this.usePullDownRefresh){
      this.removePullDownListeners();
    }
  },
}
</script>

<style scoped>
.root {
  position: relative;
  height:100%;
  overflow: hidden;
}
.virtual-list-view-phantom {
  top:0;
}
.virtual-list-view-content {
  top:0;
  position: absolute;
  padding: 0 0px;
  width: 100%;
}
.virtual-list-view {
  position: relative;
  overflow-y: scroll;
  height: 100%;
}
.item-invisible {
 visibility: hidden;
 position: absolute;
 top:0;
}
/*css for pull down refresh*/
.downwarp {
  position: relative;
  width: 100%;
  overflow: hidden;
  text-align: center;
}
.downwarp .downwarp-content {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  min-height: 30px;
  padding: 10px 0;
}
.downwarp-progress {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid gray;
  border-bottom-color: transparent;
  vertical-align: middle;
}
.downwarp-tip {
  display: inline-block;
  font-size: 12px;
  color: gray;
  vertical-align: middle;
  margin-left: 8px;
}
.rotate {
  animation: rotate 0.6s linear infinite;
}
.pull-top-animation {
  transition-duration: 300ms;
  transition-property: height;
  transform: translateZ(0);
}
@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
