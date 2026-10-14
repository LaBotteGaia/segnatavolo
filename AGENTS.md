<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Restaurant agenda: all staff share data; RLS allows any authenticated user full access (internal tool). Pages live under src/routes/_authenticated; data hooks in src/lib/data.ts.
- Assigned tables are stored as uuid[] on reservations, so deleting a reservation frees its tables automatically.
