<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html
-->
<script lang="ts">
    import { ensureKatex, katexReady, renderMathToString } from "$lib/teachback/math";

    let { tex, display = false }: { tex: string; display?: boolean } = $props();

    ensureKatex();

    // The `ready` argument is what makes this re-render once KaTeX finishes
    // loading (KaTeX is loaded lazily from a CDN).
    function render(_ready: boolean, t: string, d: boolean): string {
        return renderMathToString(t, d);
    }
    const html = $derived(render($katexReady, tex, display));
</script>

{#if display}
    <div class="tb-math-display">{@html html}</div>
{:else}
    <span class="tb-math-inline">{@html html}</span>
{/if}

<style lang="scss">
    .tb-math-display {
        overflow-x: auto;
        padding: 0.35em 0;
    }
    .tb-math-inline {
        white-space: nowrap;
    }
</style>
