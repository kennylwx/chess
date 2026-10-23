"""Exercise protocol output in a PTY; this is not a visual terminal test."""
import os, pty, subprocess, select, time, struct, fcntl, termios, signal, tempfile, sys
CLI = sys.argv[1]
def scenario(graphics, konsole=False, unknown=False, ascii=False):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 80, 0, 0))
    with tempfile.TemporaryDirectory() as directory:
        env = dict(os.environ, TERM='xterm-kitty')
        env.pop('TMUX', None); env.pop('STY', None)
        env.pop('KONSOLE_VERSION', None); env.pop('TERM_PROGRAM', None)
        if konsole: env['KONSOLE_VERSION'] = '250402'
        if unknown: env['TERM'] = 'xterm-256color'
        extra = ['--graphics', 'ascii'] if ascii else []
        child = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', CLI, '--depth', '1', '--db', directory+'/games.sqlite'] + extra, stdin=slave, stdout=slave, stderr=slave, env=env)
        os.close(slave)
        output = b''
        transcript = b''
        def until(value, timeout=10):
            nonlocal output, transcript
            deadline=time.monotonic()+timeout
            while value not in output:
                assert time.monotonic()<deadline, ('timeout',value,output[-500:])
                if select.select([master], [], [], .1)[0]:
                    try:
                        chunk = os.read(master, 65536)
                        output += chunk
                        transcript += chunk
                    except OSError: raise AssertionError(('exit',child.poll(),output[-500:]))
            current=output; output=b''; return current
        try:
            if not konsole and not unknown and not ascii:
                until(b'\x1b[c')
                reply=b'\x1b_Gi=73192;OK\x1b\\' if graphics else b''
                os.write(master, reply+b'\x1b[6;18;9t\x1b[?1;2c')
            frame=until(b'Type any moves')
            assert (b'a=T' in frame)==graphics
            if konsole or unknown or ascii: assert b'\x1b_G' not in frame
            if ascii:
                assert b'White: KQRBNP  Black: kqrbnp' in frame
                assert not any(glyph.encode() in frame for glyph in '♔♚♜♟')
            os.write(master,b'e4\r')
            until(b'Black plays')
            # Finish the prompt frame before testing the next command.
            time.sleep(.1)
            os.write(master,b'/help\r')
            help_frame=until(b'COMMANDS')
            assert (b'a=d,d=I' in help_frame)==graphics
            os.write(master,b'/back\r')
            until(b'Type any moves')
            for height, width in [(25, 60), (30, 70)]:
                fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', height, width, 0, 0))
                os.kill(child.pid,signal.SIGWINCH)
                if graphics:
                    until(b'\x1b[c')
                    os.write(master, b'\x1b_Gi=73192;OK\x1b\\\x1b[6;18;9t\x1b[?1c')
                resized=until(f'\x1b[{height - 1};2H'.encode())
                if graphics:
                    assert f',r={height - 8},'.encode() in resized and b',c=' not in resized
            os.write(master,b'/quit\r')
            final=until(b'\x1b[?1049l')
            if graphics: assert b'a=d,d=I' in final
            assert child.wait(timeout=5)==0
            if konsole or unknown or ascii:
                assert b'\x1b_G' not in transcript and b'Gi=73192' not in transcript
            print(('ASCII board' if ascii else 'unknown-terminal fallback' if unknown else 'Konsole fallback' if konsole else 'graphics' if graphics else 'text fallback')+': move/reply, help/back, two resizes and exit passed')
        finally:
            if child.poll() is None: child.kill();child.wait()
            os.close(master)
scenario(True)
scenario(False)
scenario(False, konsole=True)
scenario(False, unknown=True)
scenario(False, ascii=True)
