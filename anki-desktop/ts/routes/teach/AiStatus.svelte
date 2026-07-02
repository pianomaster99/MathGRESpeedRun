<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

Shows whether the real AI evaluator is diagnosing the lesson, or whether we've
fallen back to the basic offline checker (e.g. the proxy server isn't running).
-->
<script lang="ts">
    import { aiStatus } from "$lib/teachback/llm";

    let { compact = false }: { compact?: boolean } = $props();

    const ok = $derived($aiStatus.online && $aiStatus.hasKey);
</script>

{#if $aiStatus.checked}
    <span
        class="ai-status"
        class:ok
        class:bad={!ok}
        title={ok
            ? `AI evaluator connected${$aiStatus.model ? ` (${$aiStatus.model})` : ""}`
            : "AI evaluator offline — using the basic checker. Start the proxy: just teachback-server"}
    >
        <span class="dot"></span>
        {#if !compact}
            {ok ? "AI evaluator on" : "AI offline — basic checker"}
        {/if}
    </span>
{/if}

<style lang="scss">
    .ai-status {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        white-space: nowrap;

        &.ok {
            color: #16a34a;
            background: color-mix(in srgb, #16a34a 12%, transparent);
        }
        &.bad {
            color: #d97706;
            background: color-mix(in srgb, #d97706 15%, transparent);
        }
    }

    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
    }
</style>
