<script lang="ts">
  type MovieType = {
		Title: string,
		Year: string,
		imdbID: string,
		Type: string,
		Poster: string,
	};

  import { onMount } from 'svelte';
  import VirtualList from 'svelte-tiny-virtual-list';

  export let value: string;

  let page: number = 1;
  let listWidth: number = 0;
	let list: MovieType[] = [];

  const api: string = 'http://www.omdbapi.com/?apikey=228e48ed';

  function fetchMovies(search: string): Promise<any> {
    return fetch(`${api}&s=${search}&page=${page}`)
      .then(response => response.json())
  }

  function onScroll({detail: {event}}): void {
    if (event.target.clientWidth + event.target.scrollLeft >= event.target.scrollWidth) {
      fetchMovies(value)
        .then(data => {
          if (data.Search.length) {
            page += 1;
            list = [...list, ...data.Search];
          }
        });
    }
  }

  onMount(async () => {
    fetchMovies(value)
    .then(data => {
      if (data.Search.length) {
        page += 1;
        list = [...list, ...data.Search];
      }
    });
  });
</script>

<div class="list" bind:offsetWidth={listWidth}>
  <h2>{value}</h2>
  <VirtualList scrollDirection={'horizontal'} height="320px" width={listWidth} itemSize={210} itemCount={list.length} on:afterScroll={onScroll}>
    <div slot="item" let:index let:style {style} class="sticker" data-num={index + 1}>
      <div class="img-wrapper"><img class="img-fit" src={list[index].Poster} alt={list[index].Title}></div>
      <p>{list[index].Title}</p>
    </div>
  </VirtualList>
</div>

<style>
  h2 {
    text-transform: capitalize;
    margin: 0;
    margin-bottom: 8px;
  }

	p {
		margin: 0;
    margin-top: 8px;
		width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.list {
		height: 360px;
	}

	.list :global(.virtual-list-wrapper) {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.list :global(.virtual-list-wrapper)::-webkit-scrollbar {
		display: none;
	}

	.sticker {
		box-sizing: border-box;
		height: 100%;
		padding-right: 16px;
	}

	.img-wrapper {
		width: 100%;
		height: 270px;
	}

	.img-fit {
		object-fit: cover;
    height: 100%;
    width: 100%;
	}
</style>