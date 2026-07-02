<!--
Copyright: Ankitects Pty Ltd and contributors
License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

A simSchool-style classroom (kids at desks) plus a live chat with the class. The
kids greet you at the start, react/ask about real gaps as you post to the board,
and you can talk back to them — they answer or ask follow-ups.
-->
<script lang="ts">
    import type { Session } from "$lib/teachback/state";
    import type { ChatMessage, LessonSession } from "$lib/teachback/types";

    let { session }: { session: Session } = $props();

    const s = $derived($session as LessonSession);

    const shirts = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

    function studentName(id?: string): string {
        return s.lesson.students.find((st) => st.id === id)?.name ?? "Student";
    }

    // Latest message each kid has said (drives the speech bubble above their desk).
    function latestFor(studentId: string): ChatMessage | undefined {
        for (let i = s.messages.length - 1; i >= 0; i--) {
            const m = s.messages[i];
            if (m.role === "student" && m.studentId === studentId) {
                return m;
            }
        }
        return undefined;
    }

    let feedEl: HTMLDivElement | undefined = $state();

    // Auto-scroll the chatter feed to the newest message.
    $effect(() => {
        void s.messages.length;
        if (feedEl) {
            queueMicrotask(() => (feedEl!.scrollTop = feedEl!.scrollHeight));
        }
    });
</script>

<div class="students">
    <div class="students-head">
        <h3>The Class</h3>
        {#if s.checking}
            <span class="thinking" title="A kid is thinking">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </span>
        {/if}
    </div>

    <div class="scene">
        <div class="kids">
            {#each s.lesson.students as student, i}
                {@const msg = latestFor(student.id)}
                <div class="seat" class:asking={msg?.kind === "question"}>
                    {#if msg}
                        <div class="bubble" class:question={msg.kind === "question"}>
                            <p>{msg.text}</p>
                        </div>
                    {/if}
                    <div class="kid">
                        <div class="head">{student.avatar}</div>
                        <div class="body" style={`background:${shirts[i % shirts.length]}`}></div>
                    </div>
                    <div class="desk"></div>
                    <div class="name">{student.name}</div>
                </div>
            {/each}
        </div>
    </div>

    <div class="chat">
        <div class="feed" bind:this={feedEl}>
            {#each s.messages as m (m.id)}
                <div class="msg">
                    <span class="who">{studentName(m.studentId)}</span>
                    <span class="bubble-line" class:q={m.kind === "question"}>{m.text}</span>
                </div>
            {/each}
        </div>
    </div>
</div>

<style lang="scss">
    .students {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .students-head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex: 0 0 auto;

        h3 {
            margin: 0 0 0.5rem;
        }
    }

    .thinking {
        display: inline-flex;
        gap: 3px;
        margin-bottom: 0.4rem;

        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--tb-accent, #3b82f6);
            animation: blink 1.2s infinite ease-in-out;

            &:nth-child(2) {
                animation-delay: 0.2s;
            }
            &:nth-child(3) {
                animation-delay: 0.4s;
            }
        }
    }

    @keyframes blink {
        0%,
        80%,
        100% {
            opacity: 0.2;
        }
        40% {
            opacity: 1;
        }
    }

    .scene {
        flex: 0 0 auto;
        border-radius: 14px;
        padding: 3.4rem 0.75rem 1rem;
        background: linear-gradient(180deg, #cfe3f5 0%, #cfe3f5 52%, #d8b58a 52%, #c79b6a 100%);
        border: 1px solid var(--tb-border, #e2e8f0);
        box-shadow: inset 0 -8px 18px rgba(0, 0, 0, 0.08);
    }

    .kids {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        column-gap: 0.75rem;
        row-gap: 3.6rem;
        align-items: end;
    }

    .seat {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;

        &.asking {
            transform: translateY(-3px);
        }
    }

    .kid {
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 1;
    }

    .head {
        font-size: 2.6rem;
        line-height: 1;
        filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15));
    }

    .body {
        width: 66px;
        height: 30px;
        margin-top: -4px;
        border-radius: 34px 34px 10px 10px;
        box-shadow: inset 0 -4px 6px rgba(0, 0, 0, 0.15);
    }

    .desk {
        width: 96px;
        height: 22px;
        margin-top: -8px;
        background: linear-gradient(180deg, #a9744a 0%, #8a5c37 100%);
        border-radius: 5px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.22);
        z-index: 2;
    }

    .name {
        margin-top: 0.3rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: #1f2937;
        background: rgba(255, 255, 255, 0.75);
        padding: 0 0.4rem;
        border-radius: 4px;
    }

    .bubble {
        position: absolute;
        bottom: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%);
        width: max(92%, 150px);
        background: #fff;
        color: #1f2937;
        border: 2px solid #cbd5e1;
        padding: 0.45rem 0.65rem;
        border-radius: 14px;
        font-size: 0.82rem;
        line-height: 1.3;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
        z-index: 4;

        &.question {
            border-color: var(--tb-accent, #3b82f6);
            background: #eff6ff;
        }

        p {
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        &::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 7px solid transparent;
            border-top-color: #cbd5e1;
        }
        &.question::after {
            border-top-color: var(--tb-accent, #3b82f6);
        }
    }

    /* --- chat --- */
    .chat {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        margin-top: 0.75rem;
    }

    .feed {
        flex: 1 1 auto;
        min-height: 80px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.25rem;
    }

    .msg {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        max-width: 90%;
    }

    .who {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--tb-muted, #64748b);
        margin: 0 0.4rem;
    }

    .bubble-line {
        background: var(--tb-panel-2, #f1f5f9);
        border: 1px solid var(--tb-border, #e2e8f0);
        padding: 0.4rem 0.6rem;
        border-radius: 12px;
        font-size: 0.9rem;
        line-height: 1.35;

        &.q {
            border-color: var(--tb-accent, #3b82f6);
            background: #eff6ff;
        }
    }
</style>
