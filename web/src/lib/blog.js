// Blog posts: published posts from admin → Blog, or the starter articles until there are some.
import { useEffect, useState } from "react";
import { api } from "./api";
import { STARTER_POSTS } from "../content/blogPosts";

export const readMinutes = (text = "") => Math.max(2, Math.round(String(text).split(/\s+/).length / 200));

let cache = null;
async function loadPosts() {
  if (cache) return cache;
  try {
    const r = await api("/blog?limit=24");
    cache = r.items?.length ? r.items : STARTER_POSTS;
  } catch {
    cache = STARTER_POSTS; // no API yet (or offline) — show the starter articles
  }
  return cache;
}

export function usePosts() {
  const [posts, setPosts] = useState(cache);
  useEffect(() => {
    let alive = true;
    loadPosts().then((p) => alive && setPosts(p));
    return () => { alive = false; };
  }, []);
  return posts; // null while loading
}

export function usePost(slug) {
  const [state, setState] = useState({ post: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState({ post: null, loading: true });
    (async () => {
      const starter = STARTER_POSTS.find((p) => p.slug === slug);
      let post = null;
      try {
        post = (await api(`/blog/${encodeURIComponent(slug)}`)).post;
      } catch {
        post = starter || null;
      }
      if (alive) setState({ post: post || starter || null, loading: false });
    })();
    return () => { alive = false; };
  }, [slug]);
  return state;
}

export const postDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "");
