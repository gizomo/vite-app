<script lang="ts">
  import VirtualList from 'svelte-tiny-virtual-list';
  import HorizontalList from './HorizontalList.svelte';
  import SpatialNavigator from './navigation/spatial-navigator';
  import {onMount, onDestroy} from 'svelte';

  export let name: string = 'Vite App';

  const list: string[] = [
    'book',
    'love',
    'space',
    'robot',
    'war',
    'man',
    'story',
    'chess',
    'kill',
    'black',
    'white',
    'car',
    'stone',
    'life',
  ];
  let listHeight: number = 0;

  window['nav'] = new SpatialNavigator();
  window['nav'].init();
  // window['nav'].addSection({
  //   id: 'mainnavs',
  //   selector: '.mainnavs .focusable',
  //   defaultElementSelector: 'h1',
  //   priority: 'default-element',
  // });

  onMount(() => {
    // window['nav'].sections['mainnavs'].focus();
  });

  onDestroy(() => {
    window['nav'].uninit();
  });
</script>

<main class="mainnavs">
  <!-- <h1 class="focusable" tabindex="-1">{name}</h1> -->
  <h1>{name}</h1>
  <div class="list" bind:offsetWidth={listHeight}>
    <VirtualList height={listHeight} itemSize={360} width={'100%'} itemCount={list.length}>
      <div slot="item" let:index let:style {style} data-num={index + 1}>
        <HorizontalList value={list[index]} />
      </div>
    </VirtualList>
  </div>
</main>

<style>
  main {
    height: 100%;
    width: 100%;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
    padding: 0 40px;
  }

  .list {
    flex-grow: 1;
  }

  .list :global(.virtual-list-wrapper) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .list :global(.virtual-list-wrapper)::-webkit-scrollbar {
    display: none;
  }
</style>
