import LayoutPill from "./LayoutPill";
import HeaderLogo from "./Header/HeaderLogo";
import HeaderNav from "./Header/HeaderNav";
import StarsIcon from "../icons/StarsIcon";

export default function Header({
  mode = "default",
  handleLogout,
}: {
  mode?: "default" | "login";
  handleLogout?: () => void;
}) {
  return (
    <LayoutPill>
      <HeaderLogo
        image={require("../../assets/logo.svg")}
        text="Agent DKG"
        textFont="SpaceGrotesk_400Regular"
        style={[
          { flex: 1 },
          mode === "login" && {
            justifyContent: "center",
            marginLeft: -16,
          },
        ]}
      />

      {mode === "default" && (
        <HeaderNav style={{ flex: 1 }}>
          <HeaderNav.Link href="/chat" text="Miner" icon={StarsIcon} />
        </HeaderNav>
      )}

      {mode === "default" && (
        <HeaderNav
          style={{ flex: 1, justifyContent: "flex-end", paddingRight: 32 }}
        >
          <HeaderNav.Link text="Settings" href="/settings" />
          {handleLogout && (
            <HeaderNav.Link text="Logout" onPress={handleLogout} />
          )}
        </HeaderNav>
      )}
    </LayoutPill>
  );
}
