# Ypsilon terminal greeting for fish.  Install:  cp extras/fish_greeting.fish ~/.config/fish/functions/
# Every line is centred over the fastfetch box below it (5 columns of padding + a 37-column box,
# see ~/.config/fastfetch/config.jsonc) and coloured with the active Ypsilon theme
# (extras/current/palette.txt, rewritten by `ypsilon theme set|auto`).
function fish_greeting
    set -l primary 9d7cff
    set -l muted 8b93b8
    set -l root $YPSILON_ROOT
    test -n "$root"; or set root ~/Projects/Ypsilon
    if test -r $root/extras/current/palette.txt
        for line in (cat $root/extras/current/palette.txt)
            set -l kv (string split -m1 = -- $line)
            switch $kv[1]
                case primary
                    set primary (string trim -l -c '#' -- $kv[2])
                case muted
                    set muted (string trim -l -c '#' -- $kv[2])
            end
        end
    end

    set -l pad_left 5 # fastfetch --key-padding-left
    set -l box 37 # width of the ╭───╮ box
    for row in "bold $primary|✦" "bold $primary|Y  P  S  I  L  O  N" "normal $muted|glass · animated · yours"
        set -l parts (string split -m1 '|' -- $row)
        set -l style (string split ' ' -- $parts[1])
        set -l len (string length --visible -- $parts[2])
        echo -n (string repeat -n (math "$pad_left + floor(($box - $len) / 2)") ' ')
        test $style[1] = bold; and set_color --bold $style[2]; or set_color $style[2]
        echo $parts[2]
        set_color normal
    end
    command -q fastfetch; and fastfetch --key-padding-left $pad_left
end
