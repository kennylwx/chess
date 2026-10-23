"""Exercise protocol output in a PTY; this is not a visual terminal test."""
import os, pty, subprocess, select, time, struct, fcntl, termios, signal, tempfile, sys
CLI = sys.argv[1]
def scenario(graphics):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 80, 0, 0))
    with tempfile.TemporaryDirectory() as directory:
        env = dict(os.environ, TERM='xterm-kitty')
        env.pop('TMUX', None); env.pop('STY', None)
        child = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', CLI, '--depth', '1', '--db', directory+'/games.sqlite'], stdin=slave, stdout=slave, stderr=slave, env=env)
        os.close(slave)
        output = b''
        def until(value, timeout=10):
            nonlocal output
            deadline=time.monotonic()+timeout
            while value not in output:
                assert time.monotonic()<deadline, ('timeout',value,output[-500:])
                if select.select([master], [], [], .1)[0]:
                    try: output+=os.read(master, 65536)
                    except OSError: raise AssertionError(('exit',child.poll(),output[-500:]))
            current=output; output=b''; return current
        try:
            until(b'\x1b[c')
            reply=b'\x1b_Gi=73192;OK\x1b\\' if graphics else b''
            os.write(master, reply+b'\x1b[?1;2c')
            frame=until(b'Type any moves')
            assert (b'a=T' in frame)==graphics
            os.write(master,b'e4\r')
            until(b'Black plays')
            # Finish the prompt frame before testing the next command.
            time.sleep(.1)
            os.write(master,b'/help\r')
            help_frame=until(b'COMMANDS')
            assert (b'a=d,d=I' in help_frame)==graphics
            os.write(master,b'/back\r')
            until(b'Type any moves')
            fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 25, 60, 0, 0))
            os.kill(child.pid,signal.SIGWINCH)
            resized=until(b'\x1b[24;2H')
            if graphics: assert b'c=58,r=17' in resized
            os.write(master,b'/quit\r')
            final=until(b'\x1b[?1049l')
            if graphics: assert b'a=d,d=I' in final
            assert child.wait(timeout=5)==0
            print(('graphics' if graphics else 'text fallback')+': move/reply, help/back, resize and exit passed')
        finally:
            if child.poll() is None: child.kill();child.wait()
            os.close(master)
scenario(True)
scenario(False)
